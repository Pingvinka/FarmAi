const fetch = require('node-fetch');

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { message, context } = JSON.parse(event.body);
        const apiKey = process.env.OPENROUTER_TOKEN;

        if (!apiKey) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'OPENROUTER_TOKEN не настроен' })
            };
        }

        // Формируем запрос к OpenRouter
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://farmai.netlify.app',
                'X-Title': 'Глаз фермы'
            },
            body: JSON.stringify({
                model: 'qwen/qwen-2.5-3b-instruct', // или 'microsoft/phi-3.5-mini-instruct'
                messages: [
                    {
                        role: 'system',
                        content: `Вы ветеринарный консультант системы "Глаз фермы". Отвечайте кратко на русском. Контекст: ${context || 'нет данных'}`
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 0.7,
                max_tokens: 200
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('OpenRouter error:', data);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: data.error?.message || 'Ошибка OpenRouter' })
            };
        }

        const reply = data.choices?.[0]?.message?.content || 'Не удалось получить ответ.';

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};