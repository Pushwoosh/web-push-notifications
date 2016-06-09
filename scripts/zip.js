import path from 'path';
import {exec} from 'child_process';
import {version} from '../package.json';

const distPath = path.normalize(path.join(__dirname, '../dist'));

exec(`zip PushwooshWebSDK-${version}.zip *`, {cwd: distPath}, (e) => console.log(e));
