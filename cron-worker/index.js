// 取代 cron-job.org：每天定時呼叫主站的揪團流標 API
export default {
    async scheduled(event, env, ctx) {
        const res = await fetch('https://tabletop-game.pages.dev/api/group-gatherings/expire', {
            method: 'POST',
            headers: { 'X-Cron-Secret': env.CRON_SECRET },
        });
        console.log(`expire cron: ${res.status} ${await res.text()}`);
    },
};
