const fetch = require('node-fetch');

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Метод не разрешён' })
        };
    }

    try {
        const { message, context } = JSON.parse(event.body);

        if (!message) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Вопрос не может быть пустым' })
            };
        }

        const apiKey = process.env.OPENROUTER_TOKEN;

        if (!apiKey) {
            console.error('❌ OPENROUTER_TOKEN не настроен!');
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'OPENROUTER_TOKEN не настроен в переменных окружения Netlify'
                })
            };
        }

        console.log('✅ OPENROUTER_TOKEN найден, длина:', apiKey.length);
        console.log('💬 Вопрос пользователя:', message);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://farmai.netlify.app',
                'X-Title': 'FarmAi'
            },
            body: JSON.stringify({
                // ✅ Фиксируем рабочую модель
                model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
                messages: [
                    {
                        role: 'system',
                        content: `Вы профессиональный ветеринарный консультант системы "FarmAi". Отвечайте кратко, по делу, на русском языке. Контекст о животном: ${context || 'нет данных'}`
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 0.7,
                max_tokens: 300
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Ошибка OpenRouter:', response.status, errorText);
            return {
                statusCode: response.status,
                body: JSON.stringify({
                    error: 'Ошибка OpenRouter API',
                    status: response.status,
                    details: errorText
                })
            };
        }

        const data = await response.json();

        let reply = 'Извините, я не смог обработать ваш запрос.';
        if (data.choices && data.choices[0] && data.choices[0].message) {
            reply = data.choices[0].message.content;
            console.log('📝 Ответ ИИ:', reply);
        } else {
            console.log('⚠️ Неожиданный формат ответа:', JSON.stringify(data));
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply })
        };

    } catch (error) {
        console.error('💥 Ошибка в chat.js:', error.message);
        console.error('📚 Стэк:', error.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Внутренняя ошибка сервера',
                details: error.message
            })
        };
    }
};