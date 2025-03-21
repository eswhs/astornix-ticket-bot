require('dotenv').config(); // .env dosyasını kullanabilmek için gerekli

const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, EmbedBuilder, PermissionsBitField, ActivityType, VoiceChannel } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
const discordTranscripts = require('discord-html-transcripts');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates, // Sesli kanal durumlarını izlemek için
    ]
});

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

const ticketOwners = new Map();
const ticketClaimed = new Map();

// Kategorilere emoji ekledim
const ticketTypes = {
    donate: { name: "Donate", emoji: "<:emoji_1:1352277300431032411>" },
    support: { name: "Destek", emoji: "<:emoji_1:1352277300431032411>" },
    jail: { name: "Jail İtiraz", emoji: "<:emoji_1:1352277300431032411>" },
    complaint: { name: "Şikayet", emoji: "<:emoji_1:1352277300431032411>" },
    staffComplaint: { name: "Yetkili Şikayet", emoji: "<:emoji_1:1352277300431032411>" },
    assets: { name: "Malvarlık", emoji: "<:emoji_1:1352277300431032411>" },
    password: { name: "Şifre/Serial İşlemleri", emoji: "<:emoji_1:1352277300431032411>" },
    interior: { name: "İnterior İşlemleri", emoji: "<:emoji_1:1352277300431032411>" },
    unionHelp: { name: "Birlik Yardımı İşlemleri", emoji: "<:emoji_1:1352277300431032411>" }
};

client.once('ready', () => {
    console.log(`Botun developeri ${client.user.tag} eswh`);

    // .env dosyasından sesli kanal ID'sini al
    const voiceChannelId = process.env.SILENT_VOICE_CHANNEL_ID;
    const guild = client.guilds.cache.get(GUILD_ID); // Belirtilen sunucuyu alıyoruz
    const voiceChannel = guild.channels.cache.get(voiceChannelId); // Sesli kanal ID'sine göre kanalı bul

    if (voiceChannel) {
        // Sesli kanala bağlan
        joinVoiceChannelSilently(voiceChannel);
    } else {
        console.log('Belirtilen sesli kanal bulunamadı!');
    }

    // Botun aktif durumunu ayarlama
    client.user.setPresence({
        activities: [{ name: 'Oynuyor Kısmı', type: ActivityType.Playing }],
        status: 'dnd',
    });
});

// Sesli kanala bağlanma fonksiyonu
async function joinVoiceChannelSilently(channel) {
    if (channel instanceof VoiceChannel) {
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        connection.on(VoiceConnectionStatus.Ready, () => {
            console.log('Bot sesli kanala bağlandı ancak ses göndermiyor.');
        });
    } else {
        console.log('Bu kanal sesli kanal değil!');
    }
}

// Ticket işlemleri
client.on('interactionCreate', async interaction => {
    if (interaction.isCommand() && interaction.commandName === 'ticket') {
        // Kullanıcının yetkili olup olmadığını kontrol et
        if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
            return interaction.reply({ content: 'Bu komutu sadece yetkililer kullanabilir!', ephemeral: true });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_ticket_type')
                    .setPlaceholder('Bir kategori seçin')
                    .addOptions(
                        Object.entries(ticketTypes).map(([key, value]) => ({
                            label: value.name,
                            description: `${value.name} için ticket oluştur`,
                            value: key,
                            emoji: value.emoji
                        }))
                    )
            );

        const embed = new EmbedBuilder()
            .setTitle('Eswh Ticket Sistemi')
            .setDescription('Lütfen aşağıdaki menüden size uygun olan kategoriyi seçiniz.')
            .setFooter({ text: 'Powered by eswh' })
            .setColor('#0099ff')
            .setImage('https://cdn.discordapp.com/banners/1294317366670393395/e3af0f7b36457906fd7193e1f2098557.webp?size=1024&format=webp&width=922&height=0')
            .setThumbnail('https://cdn.discordapp.com/icons/1294317366670393395/273805a7a4914de8b2c8875925cd22c1.webp?size=1024&format=webp&width=461&height=461');

        await interaction.reply({ embeds: [embed], components: [row] });
    }


    if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
        const selectedType = interaction.values[0];
        const channelName = `${selectedType}-${interaction.user.username}`; // **Kategoriye göre kanal adı**

        const channel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                },
                {
                    id: STAFF_ROLE_ID,
                    allow: [PermissionsBitField.Flags.ViewChannel],
                    deny: [PermissionsBitField.Flags.SendMessages],
                },
            ],
        });

        ticketOwners.set(channel.id, interaction.user.id);

        const ticketControls = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Kapat')
                    .setEmoji('🔐')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('Üstlen')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('transfer_ticket')
                    .setLabel('Devret')
                    .setEmoji('🔄')
                    .setStyle(ButtonStyle.Primary)
            );

        const ticketEmbed = new EmbedBuilder()
            .setTitle(`${ticketTypes[selectedType].emoji} ${ticketTypes[selectedType].name} Ticket`) // Başlıkta emoji gösterme
            .setDescription(`Ticket sahibi: ${interaction.user}\nLütfen sorununuzu detaylı bir şekilde açıklayın.`)
            .setColor('#0099ff')
            .setTimestamp();

        await channel.send({ embeds: [ticketEmbed], components: [ticketControls] });
        await interaction.reply({ content: `Ticket oluşturuldu: ${channel}`, ephemeral: true });
    }

    if (interaction.isButton()) {
        const channel = interaction.channel;
        const ticketOwner = ticketOwners.get(channel.id);
        const ticketClaimer = ticketClaimed.get(channel.id);

        // Buton yetki kontrolleri
        if (interaction.customId === 'close_ticket') {
            if (interaction.user.id !== ticketOwner && interaction.user.id !== ticketClaimer) {
                return interaction.reply({ content: 'Bu işlemi sadece ticket sahibi veya üstlenen yetkili yapabilir!', ephemeral: true });
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_close')
                        .setLabel('Onayla')
                        .setEmoji('✅')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancel_close')
                        .setLabel('İptal')
                        .setEmoji('❌')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.reply({ 
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Ticket Kapatma Onayı')
                        .setDescription('Bu ticketi kapatmak istediğinizden emin misiniz?')
                        .setColor('#ff0000')
                ], 
                components: [row] 
            });
        }

        if (interaction.customId === 'confirm_close') {
            await interaction.reply('Ticket kapatılıyor...');
            await createTranscript(channel, ticketOwner, interaction.user.id); // Kapatanı gönderiyoruz
            setTimeout(() => channel.delete(), 5000);
        }        

        if (interaction.customId === 'cancel_close') {
            await interaction.reply('Ticket kapatma işlemi iptal edildi.');
            setTimeout(() => interaction.message.delete(), 5000);
        }

        if (interaction.customId === 'transfer_ticket') {
            if (interaction.user.id !== ticketClaimer) {
                return interaction.reply({ content: 'Bu işlemi sadece ticketi üstlenen yetkili yapabilir!', ephemeral: true });
            }

            const transferEmbed = new EmbedBuilder()
                .setTitle('Ticket Devretme')
                .setDescription('Lütfen 30 saniye içinde devretmek istediğiniz yetkiliyi etiketleyin.')
                .setColor('#0099ff');

            await interaction.reply({ embeds: [transferEmbed], ephemeral: true });

            const filter = m => m.author.id === interaction.user.id && m.mentions.users.size > 0;
            const collector = channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async m => {
                const targetUser = m.mentions.users.first();
                const targetMember = await interaction.guild.members.fetch(targetUser.id);

                if (!targetMember.roles.cache.has(STAFF_ROLE_ID)) {
                    return interaction.followUp({ content: 'Seçtiğiniz kullanıcı yetkili değil!', ephemeral: true });
                }

                ticketClaimed.set(channel.id, targetUser.id);
                await channel.permissionOverwrites.edit(targetUser, {
                    ViewChannel: true,
                    SendMessages: true
                });

                // **Devreden kişiye mesaj yazma yetkisini kaldırma**
                await channel.permissionOverwrites.edit(interaction.user, {
                    SendMessages: false
                });

                await interaction.followUp({ content: `Ticket ${targetUser} yetkilisine devredildi.`, ephemeral: true });
                m.delete().catch(() => {});
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.followUp({ content: 'Süre doldu! Ticket devretme işlemi iptal edildi.', ephemeral: true });
                }
            });
        }

        if (interaction.customId === 'claim_ticket') {
            if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
                return interaction.reply({ content: 'Bu işlemi sadece yetkililer yapabilir!', ephemeral: true });
            }

            if (ticketClaimed.has(channel.id)) {
                return interaction.reply({ content: 'Bu ticket zaten bir yetkili tarafından üstlenilmiştir!', ephemeral: true });
            }

            ticketClaimed.set(channel.id, interaction.user.id);
            await channel.permissionOverwrites.edit(interaction.user, {
                ViewChannel: true,
                SendMessages: true,
            });

            await interaction.reply({ content: 'Ticket üstlenildi.', ephemeral: true });
        }
    }
});

async function createTranscript(channel, ticketOwner, closer) {
    // Kanal adından ticket türünü çıkarma
    const channelName = channel.name;
    const ticketTypeKey = channelName.split('-')[0]; // Örnek: donate-username -> donate
    
    const transcript = await discordTranscripts.createTranscript(channel, {
        limit: -1,
        returnBuffer: false,
        saveImages: true,
        footer: `Ticket sahibi: ${ticketOwner}`,
    });

    const logChannel = channel.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (logChannel) {
        // Ticket türü bilgisini alma
        const ticketTypeInfo = ticketTypes[ticketTypeKey] || { name: "Bilinmeyen", emoji: "❓" };
        
        // Embed mesaj oluşturma
        const embed = new EmbedBuilder()
            .setTitle(`🎫 Ticket Kapatıldı`)
            .setDescription('Bir ticket başarıyla kapatıldı. Detaylar aşağıda:')
            .addFields(
                { name: '📌 Ticket Türü', value: `${ticketTypeInfo.emoji} ${ticketTypeInfo.name}`, inline: true },
                { name: '👤 Ticket Sahibi', value: `<@${ticketOwner}>`, inline: true },
                { name: '🔒 Üstlenen Yetkili', value: `<@${ticketClaimed.get(channel.id) || 'Bilinmiyor'}>`, inline: true },
                { name: '🛑 Ticketi Kapatan', value: `<@${closer}>`, inline: true },
                { name: '📁 Transcript', value: 'Aşağıdaki dosyada mevcuttur.' }
            )
            .setColor('#ff0000')
            .setTimestamp();

        await logChannel.send({ embeds: [embed], files: [transcript] });
    }
}

client.login(TOKEN);