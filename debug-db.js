import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.argv[2] || '/app/data/database.db';
const db = new Database(dbPath, { readonly: true });

console.log('\n=== Images Table ===');
const images = db.prepare('SELECT * FROM images').all();
console.log(JSON.stringify(images, null, 2));

console.log('\n=== Settings Table ===');
const settings = db.prepare('SELECT * FROM settings').all();
console.log(JSON.stringify(settings, null, 2));

console.log('\n=== Summary ===');
console.log(`Total images: ${images.length}`);
console.log(`Images in rotation: ${images.filter(img => img.in_rotation === 1).length}`);

db.close();
