import Migrations from './Migrations';
import { type TMigrationType } from '../Storage.types';

export default class MigrationExecutor {
  db: IDBDatabase;
  migrationsBuilder: Migrations;

  constructor(
    db: IDBDatabase,
    migrationsBuilder: Migrations = new Migrations(),
  ) {
    this.db = db;
    this.migrationsBuilder = migrationsBuilder;
  }

  applyMigrations() {
    this.applyMigrationsPack(this.migrationsBuilder.all);
  }

  applyMigrationsPack(migrationsPack: Array<TMigrationType>) {
    migrationsPack.forEach((migration) => {
      migration(this.db);
    });
  }
}
