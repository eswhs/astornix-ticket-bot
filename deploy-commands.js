const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
    {
        name: 'ticket',
        description: 'Ticket panelini gönderir',
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Slash komutları yükleniyor...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('Slash komutları başarıyla yüklendi!');
    } catch (error) {
        console.error('Komutları yüklerken hata oluştu:', error);
    }
})();
