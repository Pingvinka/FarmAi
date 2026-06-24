const fetch = require('node-fetch');

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { message, context: animalContext } = JSON.parse(event.body);
        const hfToken = process.env.HF_TOKEN;

        if (!hfToken) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'HF_TOKEN не настроен в переменных окружения Netlify' })
            };
        }

        const prompt = `<|im_start|>system
Вы профессиональный ИИ-ветеринар и консультант системы "ФермAi". 
Отвечайте коротко, профессионально, на русском языке. Дайте краткий совет на основе контекста: ${animalContext}<|im_end|>
<|im_start|>user
${message}<|im_end|>
<|im_start|>assistant`;

        const response = await fetch('https://api-inference.huggingface.co/models/Qwen/Qwen2.5-1.5B-Instruct', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hfToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_new_tokens: 150,
                    temperature: 0.7,
                    return_full_text: false
                }
            })
        });

        const data = await response.json();
        let reply = 'Извините, я не смог обработать ваш запрос.';

        if (data && data[0] && data[0].generated_text) {
            reply = data[0].generated_text.trim();
        } else if (data.error) {
            reply = `Ошибка Hugging Face: ${data.error}`;
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reply })
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};