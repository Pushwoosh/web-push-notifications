import PushwooshGlobal from './classes/Global';
import {getGlobal} from './utils/functions';

const global = getGlobal();

let {Pushwoosh} = global;
let predefinedCommands;

if (Pushwoosh) {
  predefinedCommands = Pushwoosh;
}

Pushwoosh = new PushwooshGlobal();
if (Array.isArray(predefinedCommands)) {
  predefinedCommands.forEach(c => Pushwoosh.push(c));
}

global.Pushwoosh = Pushwoosh;
