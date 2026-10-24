import { createApp } from './app.js';
import { config } from './config.js';

createApp().listen(config.port, () => {
  console.log(`ТехноПрокат API слушает порт ${config.port}`);
});
