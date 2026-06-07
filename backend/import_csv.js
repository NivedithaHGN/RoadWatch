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

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
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

db.serialize(() => {
  console.log('Starting CSV dataset integration...');

  // 1. Clear existing database tables
  db.run('DELETE FROM countries');
  db.run('DELETE FROM projects');
  db.run('DELETE FROM contractors');
  db.run('DELETE FROM complaints');
  console.log('Cleared existing data from tables.');

  // 2. Import Countries
  const countriesFile = path.join(importDir, 'countries.csv');
  const countries = parseCSV(countriesFile);
  console.log(`Parsed ${countries.length} countries from CSV.`);

  const insertCountry = db.prepare(`
    INSERT INTO countries (name, center_lat, center_lng, zoom, projects_count, health_score, complaints_count, budget_count, contractors_total, contractors_active, contractors_pending)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  countries.forEach(c => {
    insertCountry.run(
      c.name,
      parseFloat(c.center_lat) || 0,
      parseFloat(c.center_lng) || 0,
      parseInt(c.zoom) || 6,
      c.projects_count || '0',
      c.health_score || '70/100',
      c.complaints_count || '0',
      c.budget_count || '$0',
      c.contractors_total || '0',
      c.contractors_active || '0',
      c.contractors_pending || '0'
    );
  });
  insertCountry.finalize();
  console.log('Countries imported successfully.');

  // 3. Import Projects
  const projectsFile = path.join(importDir, 'projects.csv');
  const projects = parseCSV(projectsFile);
  console.log(`Parsed ${projects.length} projects from CSV.`);

  const insertProject = db.prepare(`
    INSERT INTO projects (country_name, name, lat, lng, status, is_upcoming)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  projects.forEach(p => {
    insertProject.run(
      p.country_name,
      p.name,
      parseFloat(p.lat) || 0,
      parseFloat(p.lng) || 0,
      p.status,
      parseInt(p.is_upcoming) || 0
    );
  });
  insertProject.finalize();
  console.log('Projects imported successfully.');

  // 4. Import Contractors
  const contractorsFile = path.join(importDir, 'contractors.csv');
  const contractors = parseCSV(contractorsFile);
  console.log(`Parsed ${contractors.length} contractors from CSV.`);

  const insertContractor = db.prepare(`
    INSERT INTO contractors (country_name, name, completed, status)
    VALUES (?, ?, ?, ?)
  `);
  contractors.forEach(c => {
    insertContractor.run(
      c.country_name,
      c.name,
      c.completed || '0',
      c.status || 'Active'
    );
  });
  insertContractor.finalize();
  console.log('Contractors imported successfully.');

  // 5. Import Complaints
  const complaintsFile = path.join(importDir, 'complaints.csv');
  const complaints = parseCSV(complaintsFile);
  console.log(`Parsed ${complaints.length} complaints from CSV.`);

  const insertComplaint = db.prepare(`
    INSERT INTO complaints (country_name, title, description, location, status, photo_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  complaints.forEach(c => {
    insertComplaint.run(
      c.country_name,
      c.title,
      c.description || '',
      c.location || '',
      c.status || 'Pending',
      c.photo_path || ''
    );
  });
  insertComplaint.finalize();
  console.log('Complaints imported successfully.');
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('CSV Import completed successfully and database is ready!');
  }
});
