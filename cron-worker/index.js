// 取代 cron-job.org：定時呼叫主站的揪團流標 API，以及截止前 30 分鐘的團主提醒 API
export default {
    async scheduled(event, env, ctx) {
        const expireRes = await fetch('https://tabletop-game.pages.dev/api/group-gatherings/expire', {
            method: 'POST',
            headers: { 'X-Cron-Secret': env.CRON_SECRET },
        });
        console.log(`expire cron: ${expireRes.status} ${await expireRes.text()}`);

        const reminderRes = await fetch('https://tabletop-game.pages.dev/api/group-gatherings/deadline-reminder', {
            method: 'POST',
            headers: { 'X-Cron-Secret': env.CRON_SECRET },
        });
        console.log(`deadline-reminder cron: ${reminderRes.status} ${await reminderRes.text()}`);
    },
};
