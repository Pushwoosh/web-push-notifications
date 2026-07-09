import { default as migrationsInitial } from './initial';
import { type TMigrationType } from '../Storage.types';

export default class Migrations {
  get all(): Array<TMigrationType> {
    return migrationsInitial;
  }
}
