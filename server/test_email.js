import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import dns from 'dns';

// Forzar IPv4
dns.setDefaultResultOrder('ipv4first');
dotenv.config();

console.log("Testeando correo...");
console.log("Usuario:", process.env.SMTP_USER);
console.log("Contraseña:", process.env.SMTP_PASSWORD ? "******" : "MISSING");

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

async function main() {
  try {
    const info = await transporter.sendMail({
      from: `"Test" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // mandarse a sí mismo
      subject: "Test desde Render/Local",
      text: "Funciona el correo."
    });
    console.log("✓ ÉXITO:", info.messageId);
  } catch (error) {
    console.error("❌ ERROR DETALLADO:", error);
  }
}

main();
