const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'roadwatch.db');
const importDir = path.join(__dirname, 'import_data');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database at:', dbPath);
});

// Helper: Custom CSV Parser (handles values wrapped in double quotes containing commas)
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || !lines[0].trim()) return [];

  // Normalize header names: lowercase, trimmed, quotes removed
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = [];
    let insideQuote = false;
    let currentValue = '';

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim().replace(/^["']|["']$/g, ''));

    if (values.length >= headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] !== undefined ? values[index] : '';
      });
      results.push(row);
    }
  }
  return results;
}

// Bounding boxes and centers for common countries to generate map coordinates dynamically
const COUNTRY_GEO_INFO = {
  'india': { center: [20.5937, 78.9629], zoom: 5, minLat: 8.4, maxLat: 37.6, minLng: 68.7, maxLng: 97.25 },
  'bangladesh': { center: [23.6850, 90.3563], zoom: 7, minLat: 20.74, maxLat: 26.63, minLng: 88.01, maxLng: 92.67 },
  'bhutan': { center: [27.5142, 90.4336], zoom: 8, minLat: 26.7, maxLat: 28.3, minLng: 88.8, maxLng: 92.1 },
  'nepal': { center: [28.3949, 84.1240], zoom: 7, minLat: 26.3, maxLat: 30.4, minLng: 80.0, maxLng: 88.2 },
  'sri lanka': { center: [7.8731, 80.7718], zoom: 8, minLat: 5.9, maxLat: 9.8, minLng: 79.5, maxLng: 81.9 },
  'malaysia': { center: [4.2105, 101.9758], zoom: 6, minLat: 1.0, maxLat: 7.0, minLng: 99.5, maxLng: 119.5 },
  'usa': { center: [37.0902, -95.7129], zoom: 4, minLat: 25.0, maxLat: 49.0, minLng: -125.0, maxLng: -66.9 },
  'germany': { center: [51.1657, 10.4515], zoom: 6, minLat: 47.2, maxLat: 55.0, minLng: 5.8, maxLng: 15.0 },
  'uk': { center: [55.3781, -3.4360], zoom: 6, minLat: 49.9, maxLat: 58.6, minLng: -8.6, maxLng: 1.7 }
};

function getCountryGeo(countryName) {
  const nameLower = countryName.toLowerCase().trim();
  if (COUNTRY_GEO_INFO[nameLower]) {
    return COUNTRY_GEO_INFO[nameLower];
  }
  // Default fallback if unknown
  return { center: [20.0, 77.0], zoom: 5, minLat: 10.0, maxLat: 30.0, minLng: 70.0, maxLng: 90.0 };
}

function getRandomCoords(geoInfo) {
  const lat = geoInfo.minLat + Math.random() * (geoInfo.maxLat - geoInfo.minLat);
  const lng = geoInfo.minLng + Math.random() * (geoInfo.maxLng - geoInfo.minLng);
  return { lat, lng };
}

function formatBudget(amount) {
  if (amount >= 1e9) {
    return '$' + (amount / 1e9).toFixed(1) + 'B';
  } else if (amount >= 1e6) {
    return '$' + (amount / 1e6).toFixed(1) + 'M';
  } else if (amount >= 1e3) {
    return '$' + (amount / 1e3).toFixed(1) + 'K';
  }
  return '$' + amount.toLocaleString();
}

function capitalizeWords(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

db.serialize(() => {
  console.log('Starting Combined CSV dataset integration...');

  // 1. Clear existing database tables
  db.run('DELETE FROM countries');
  db.run('DELETE FROM projects');
  db.run('DELETE FROM contractors');
  db.run('DELETE FROM complaints');
  console.log('Cleared existing data from countries, projects, contractors, and complaints tables.');

  // Read files in import_data directory
  if (!fs.existsSync(importDir)) {
    console.error(`Import directory not found: ${importDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(importDir);
  const csvFiles = files.filter(f => f.toLowerCase().endsWith('.csv'));

  if (csvFiles.length === 0) {
    console.log('No CSV files found in import_data directory.');
    return;
  }

  let importedCountries = 0;

  csvFiles.forEach(file => {
    // Skip old template files
    if (['countries.csv', 'projects.csv', 'contractors.csv', 'complaints.csv'].includes(file.toLowerCase())) {
      console.log(`Skipping template file: ${file}`);
      return;
    }

    const filePath = path.join(importDir, file);
    const rows = parseCSV(filePath);
    if (rows.length === 0) {
      console.log(`Skipping empty or unparseable CSV: ${file}`);
      return;
    }

    // Verify it contains target attributes
    const firstRowKeys = Object.keys(rows[0]);
    if (!firstRowKeys.includes('osm_id') || !firstRowKeys.includes('road_name')) {
      console.log(`Skipping file ${file} as it does not match the combined road dataset schema (missing osm_id or road_name).`);
      return;
    }

    // Determine country name from filename (e.g. "india.csv" -> "India")
    const rawCountryName = path.basename(file, path.extname(file));
    const countryName = capitalizeWords(rawCountryName.replace(/[-_]/g, ' '));
    console.log(`Processing dataset for country: ${countryName} (${rows.length} records)`);

    const geoInfo = getCountryGeo(countryName);

    // Aggregate values
    let totalRoadHealth = 0;
    let validRoadHealthCount = 0;
    let totalComplaints = 0;
    let totalBudget = 0;
    const uniqueContractorNames = new Set();
    const contractorsData = {}; // contractorName -> { ratingSum, ratingCount, completedCount, totalCount }

    rows.forEach(row => {
      // 1. Road Health
      const health = parseFloat(row.road_health_score);
      if (!isNaN(health)) {
        totalRoadHealth += health;
        validRoadHealthCount++;
      }

      // 2. Complaints
      const complaintsCount = parseInt(row.complaints_count);
      if (!isNaN(complaintsCount)) {
        totalComplaints += complaintsCount;
      }

      // 3. Budget
      const budget = parseFloat(row.allocated_budget_usd);
      if (!isNaN(budget)) {
        totalBudget += budget;
      }

      // 4. Contractor Info
      const contractor = (row.contractor_name || '').trim();
      if (contractor && contractor.toLowerCase() !== 'none' && contractor.toLowerCase() !== 'n/a') {
        uniqueContractorNames.add(contractor);
        if (!contractorsData[contractor]) {
          contractorsData[contractor] = { ratingSum: 0, ratingCount: 0, completedCount: 0, totalCount: 0 };
        }
        
        const rating = parseFloat(row.contractor_rating);
        if (!isNaN(rating)) {
          contractorsData[contractor].ratingSum += rating;
          contractorsData[contractor].ratingCount++;
        }
        
        const condition = (row.road_condition || '').toLowerCase();
        if (['good', 'excellent', 'satisfactory', 'completed'].includes(condition)) {
          contractorsData[contractor].completedCount++;
        }
        contractorsData[contractor].totalCount++;
      }
    });

    const avgHealthScore = validRoadHealthCount > 0 ? Math.round(totalRoadHealth / validRoadHealthCount) : 75;
    const formattedHealthScore = `${avgHealthScore}/100`;
    const formattedBudget = formatBudget(totalBudget);

    // 1. Insert into countries table
    const insertCountry = db.prepare(`
      INSERT INTO countries (name, center_lat, center_lng, zoom, projects_count, health_score, complaints_count, budget_count, contractors_total, contractors_active, contractors_pending)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertCountry.run(
      countryName,
      geoInfo.center[0],
      geoInfo.center[1],
      geoInfo.zoom,
      rows.length.toString(),
      formattedHealthScore,
      totalComplaints.toString(),
      formattedBudget,
      uniqueContractorNames.size.toString(),
      uniqueContractorNames.size.toString(),
      '0'
    );
    insertCountry.finalize();
    console.log(`  - Inserted country: ${countryName} (Health: ${formattedHealthScore}, Budget: ${formattedBudget}, Complaints: ${totalComplaints}, Contractors: ${uniqueContractorNames.size})`);

    // 2. Insert into contractors table
    const insertContractor = db.prepare(`
      INSERT INTO contractors (country_name, name, completed, status)
      VALUES (?, ?, ?, ?)
    `);
    
    Object.keys(contractorsData).forEach(name => {
      const c = contractorsData[name];
      const avgRating = c.ratingCount > 0 ? (c.ratingSum / c.ratingCount) : 3.0;
      const status = avgRating >= 4.0 ? 'Top Rated' : 'Active';
      
      insertContractor.run(
        countryName,
        name,
        c.completedCount.toString(),
        status
      );
    });
    insertContractor.finalize();
    console.log(`  - Inserted ${Object.keys(contractorsData).length} contractors for ${countryName}`);

    // 3. Insert into projects table
    const insertProject = db.prepare(`
      INSERT INTO projects (country_name, name, lat, lng, status, is_upcoming)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // 4. Insert into complaints table
    const insertComplaint = db.prepare(`
      INSERT INTO complaints (country_name, title, description, location, status, created_at, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let projectsCount = 0;
    let complaintsCount = 0;

    rows.forEach(row => {
      // Parse coordinates if available, otherwise generate randomly
      let lat = parseFloat(row.latitude || row.lat);
      let lng = parseFloat(row.longitude || row.lng);

      if (isNaN(lat) || isNaN(lng)) {
        const coords = getRandomCoords(geoInfo);
        lat = coords.lat;
        lng = coords.lng;
      }

      // Determine road status
      const roadName = (row.road_name || '').trim() || (row.ref || '').trim() || `OSM Road ${row.osm_id}`;
      const condition = (row.road_condition || 'Fair').trim();
      const potholes = parseInt(row.potholes_count) || 0;
      const statusStr = `${condition} (Potholes: ${potholes}, Speed: ${row.maxspeed || 'N/A'})`;

      // Determine if project is upcoming
      const spentBudget = parseFloat(row.spent_budget_usd) || 0;
      const allocatedBudget = parseFloat(row.allocated_budget_usd) || 0;
      const isUpcoming = (spentBudget === 0 || condition.toLowerCase().includes('planned') || condition.toLowerCase().includes('upcoming')) ? 1 : 0;

      insertProject.run(
        countryName,
        roadName,
        lat,
        lng,
        statusStr,
        isUpcoming
      );
      projectsCount++;

      // Create complaint row if complaints exist or potholes > 0 or accidents > 0
      const cCount = parseInt(row.complaints_count) || 0;
      const pCount = parseInt(row.potholes_count) || 0;
      const aCount = parseInt(row.accident_count) || 0;
      const hasIssues = cCount > 0 || pCount > 0 || aCount > 0 || (row.complaint_type && row.complaint_type.toLowerCase() !== 'none');

      if (hasIssues) {
        const title = (row.complaint_type || '').trim() || (pCount > 0 ? 'Pothole Alert' : 'Road Safety Issues');
        const severity = row.accident_severity || 'Low';
        const weather = row.weather_condition || 'Clear';
        const description = `${pCount} potholes and ${aCount} accidents reported. Severity: ${severity}. Weather: ${weather}.`;
        const complaintStatus = ['good', 'excellent', 'satisfactory'].includes(condition.toLowerCase()) ? 'Resolved' : 'Pending';
        
        // Mock created and resolved dates in last 30 days
        const daysAgo = Math.random() * 30;
        const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
        let resolvedAt = null;
        if (complaintStatus === 'Resolved') {
          // Resolved 1 to 5 days after creation
          resolvedAt = new Date(new Date(createdAt).getTime() + (1 + Math.random() * 4) * 24 * 60 * 60 * 1000).toISOString();
        }

        insertComplaint.run(
          countryName,
          title,
          description,
          roadName,
          complaintStatus,
          createdAt,
          resolvedAt
        );
        complaintsCount++;
      }
    });

    insertProject.finalize();
    insertComplaint.finalize();
    console.log(`  - Inserted ${projectsCount} roads/projects and ${complaintsCount} complaints for ${countryName}`);
    importedCountries++;
  });

  console.log(`Successfully completed import of ${importedCountries} country datasets.`);
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('Database connection closed cleanly.');
  }
});
