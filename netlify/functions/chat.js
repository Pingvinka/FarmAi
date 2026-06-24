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

        // ⏱️ Замеряем время выполнения
        const startTime = Date.now();

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://farmai.netlify.app',
                'X-Title': 'FarmAi'
            },
            body: JSON.stringify({
                model: 'openrouter/free',
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

        const elapsed = Date.now() - startTime;
        console.log(`⏱️ Запрос выполнен за ${elapsed} мс`);

        // 1. Сначала читаем ответ как текст
        const rawText = await response.text();
        console.log('📦 Сырой ответ от OpenRouter (первые 200 символов):', rawText.substring(0, 200));

        // 2. Парсим JSON
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (parseError) {
            console.error('❌ Не удалось распарсить JSON:', parseError.message);
            console.error('📦 Полный сырой ответ:', rawText);
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'Ошибка парсинга JSON от OpenRouter',
                    raw: rawText.substring(0, 500)
                })
            };
        }

        // 3. Проверяем статус
        if (!response.ok) {
            console.error('❌ Ошибка OpenRouter:', response.status, data);
            return {
                statusCode: response.status,
                body: JSON.stringify({
                    error: 'Ошибка OpenRouter API',
                    status: response.status,
                    details: data
                })
            };
        }

        // 4. Извлекаем ответ (с проверкой разных форматов)
        let reply = 'Извините, я не смог обработать ваш запрос.';

        // Проверяем стандартный формат OpenRouter
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
            reply = data.choices[0].message.content;
            console.log('📝 Ответ ИИ (стандартный формат):', reply);
        }
        // Проверяем формат Hugging Face (если вдруг)
        else if (data[0] && data[0].generated_text) {
            reply = data[0].generated_text.trim();
            console.log('📝 Ответ ИИ (формат HF):', reply);
        }
        // Проверяем другие возможные форматы
        else if (data.text) {
            reply = data.text;
            console.log('📝 Ответ ИИ (формат text):', reply);
        }
        // Если ничего не нашли — логируем весь ответ
        else {
            console.log('⚠️ Неизвестный формат ответа. Полный объект:', JSON.stringify(data, null, 2));
            // Показываем пользователю, что ответ пришёл, но не в ожидаемом формате
            reply = 'Ответ получен, но в неожиданном формате. Пожалуйста, попробуйте ещё раз.';
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply })
        };

    } catch (error) {
        console.error('💥 Критическая ошибка в chat.js:', error.message);
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