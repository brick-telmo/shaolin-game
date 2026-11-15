import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
export function localDatabase(filename=':memory:') {
  const sql=new DatabaseSync(filename);
  sql.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  for(const file of readdirSync(new URL('./drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()) {
    if(sql.prepare('SELECT name FROM local_migrations WHERE name=?').get(file))continue;
    sql.exec('BEGIN');
    try{sql.exec(readFileSync(new URL('./drizzle/'+file,import.meta.url),'utf8'));sql.prepare('INSERT INTO local_migrations VALUES(?)').run(file);sql.exec('COMMIT');}
    catch(e){sql.exec('ROLLBACK');throw e;}
  }
  function statement(query,args=[]) {
    return {bind(...values){return statement(query,values);},
      async first(){return sql.prepare(query).get(...args)||null;},
      async all(){return {results:sql.prepare(query).all(...args)};},
      async run(){return this.execute();},
      execute(){const result=sql.prepare(query).run(...args);return {meta:{changes:Number(result.changes)}};}};
  }
  return {prepare:statement,async batch(statements){sql.exec('BEGIN');try{const result=statements.map(s=>s.execute());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}},close(){sql.close();}};
}
