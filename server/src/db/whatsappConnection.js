import { query, transaction } from './config.js';

export async function migrateWhatsAppConnection() {
  await transaction(async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('turnohub:whatsapp-connection',0))");
    await client.query(`CREATE TABLE IF NOT EXISTS whatsapp_cloud_connection (
      id smallint PRIMARY KEY CHECK(id=1), encrypted_token text NOT NULL,
      phone_id text NOT NULL, waba_id text NOT NULL,
      connected_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz,
      agent_enabled boolean NOT NULL DEFAULT false CHECK(agent_enabled=false)
    )`);
  });
}

export const whatsappConnectionRepository={
  async status(){return (await query('SELECT connected_at, expires_at FROM whatsapp_cloud_connection WHERE id=1')).rows[0] || null;},
  async save({encryptedToken,phoneId,wabaId,expiresIn}) {
    await query(`INSERT INTO whatsapp_cloud_connection(id,encrypted_token,phone_id,waba_id,expires_at)
      VALUES(1,$1,$2,$3,CASE WHEN $4::integer IS NULL THEN NULL ELSE now()+($4::integer * interval '1 second') END)
      ON CONFLICT(id) DO UPDATE SET encrypted_token=excluded.encrypted_token,phone_id=excluded.phone_id,waba_id=excluded.waba_id,
      connected_at=now(),expires_at=excluded.expires_at,agent_enabled=false`,[encryptedToken,phoneId,wabaId,expiresIn]);
  }
};
