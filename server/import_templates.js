import dotenv from 'dotenv';
dotenv.config();
import XLSX from 'xlsx';
import path from 'path';
import { query } from './src/db/config.js';

const excelPath = path.resolve('../Servicios_Base_Precargados.xlsx');
console.log('Reading Excel file from:', excelPath);

async function run() {
  try {
    // 1. Read Excel
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Found ${data.length} rows in Excel.`);
    if (data.length === 0) {
      console.log('No data to import.');
      process.exit(0);
    }

    // 2. Clear existing templates (optional, but good to avoid duplicates)
    console.log('Clearing existing admin template services...');
    await query('DELETE FROM admin_template_services');

    // 3. Insert rows
    let successCount = 0;
    let failCount = 0;

    for (const row of data) {
      const specialization = row.Especialidad || '';
      const name = row['Nombre del Servicio'] || '';
      const description = row['Descripción'] || '';
      const price = parseFloat(row['Precio Base (ARS)'] || 0);
      const duration_minutes = parseInt(row['Duración (min)'] || 30);
      const booking_fee = parseFloat(row['Comisión Reserva (ARS)'] || 0);
      const code = row['Código Interno'] || null;
      
      const isOnlineVal = String(row['Modalidad Online'] || '').toLowerCase().trim();
      const is_online = isOnlineVal === 'sí' || isOnlineVal === 'si' || isOnlineVal === 'yes' || isOnlineVal === 'true';

      if (!specialization || !name) {
        console.log(`Skipping row because specialization or name is missing: ${JSON.stringify(row)}`);
        failCount++;
        continue;
      }

      try {
        await query(
          `INSERT INTO admin_template_services (
            specialization, name, description, price, duration_minutes, booking_fee, code, is_online
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [specialization.trim(), name.trim(), description || '', price, duration_minutes, booking_fee, code, is_online]
        );
        successCount++;
      } catch (err) {
        console.error(`Error inserting row for specialization: ${specialization}, service: ${name}. Error:`, err.message);
        failCount++;
      }
    }

    console.log(`Import finished! Successfully imported: ${successCount}. Failed: ${failCount}.`);
    process.exit(0);
  } catch (err) {
    console.error('Import failed with error:', err);
    process.exit(1);
  }
}

run();
