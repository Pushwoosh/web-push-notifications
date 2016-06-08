import localForage from 'localforage';
import PushwooshGlobal from './classes/Global';
import {getGlobal} from './utils/functions';

const global = getGlobal();

let {Pushwoosh} = global;
let predefinedCommands;

if (Pushwoosh) {
  predefinedCommands = Pushwoosh;
}

Pushwoosh = new PushwooshGlobal();
predefinedCommands.forEach(c => Pushwoosh.push(c));

Pushwoosh.localForage = localForage; // for debug
global.Pushwoosh = Pushwoosh;
