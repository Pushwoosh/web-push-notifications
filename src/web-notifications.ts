import PushwooshSingleton from './Pushwoosh';
import {getGlobal} from './functions';
import './SubscribeWidget';
import './inboxWidget';
import './subscribePopup';

function main() {
  const global = getGlobal();
  const PW = new PushwooshSingleton();
  const commands = Array.isArray(global.Pushwoosh) ? [...global.Pushwoosh] : [];

  global.Pushwoosh = PW;
  commands.forEach((command) => PW.push(command));
}

if (document.readyState === 'complete') {
  main();
}
else {
  window.addEventListener('load', main);
}
