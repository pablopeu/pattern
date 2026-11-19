/** Future upgrades must be pure functions and covered by round-trip fixtures. */
export const LATEST_SCHEMA_VERSION=1;
type Versioned={schemaVersion:number}&Record<string,unknown>;
const migrations:Record<number,(value:Versioned)=>Versioned>={};
export function migrateDocument(raw:unknown):unknown{
 if(typeof raw!=='object'||raw===null||!('schemaVersion'in raw)||typeof raw.schemaVersion!=='number')throw Error('El archivo no declara una versión de proyecto.');
 if(raw.schemaVersion>LATEST_SCHEMA_VERSION)throw Error(`Este archivo usa la versión ${raw.schemaVersion}; esta aplicación admite hasta la versión ${LATEST_SCHEMA_VERSION}.`);
 let doc=structuredClone(raw) as Versioned;
 while(doc.schemaVersion<LATEST_SCHEMA_VERSION){const upgrade=migrations[doc.schemaVersion];if(!upgrade)throw Error(`No existe una migración para el formato ${doc.schemaVersion}.`);const next=upgrade(doc);if(next.schemaVersion<=doc.schemaVersion)throw Error('Migración de proyecto inválida.');doc=next;}
 return doc;
}
