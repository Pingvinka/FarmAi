const fetch = require('node-fetch');

exports.handler = async function (event, context) {
    console.log('📥 Запрос получен, метод:', event.httpMethod);

    // Разрешаем только POST
    if (event.httpMethod !== 'POST') {
        console.log('❌ Не POST-запрос');
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Метод не разрешён' })
        };
    }

    try {
        // 1. Парсим тело запроса
        console.log('📦 Тело запроса:', event.body);
        const { message, context: animalContext } = JSON.parse(event.body);

        if (!message) {
            console.log('❌ Нет сообщения');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Вопрос не может быть пустым' })
            };
        }

        console.log('💬 Вопрос пользователя:', message);

        // 2. Проверяем токен
        const hfToken = process.env.HF_TOKEN;
        console.log('🔑 Токен найден:', hfToken ? '✅ да, длина ' + hfToken.length : '❌ НЕТ!');

        if (!hfToken) {
            console.log('❌ HF_TOKEN отсутствует!');
            return {
                statusCode: 500,
                body: JSON.stringify({
                    error: 'HF_TOKEN не настроен в переменных окружения Netlify',
                    hint: 'Добавьте переменную HF_TOKEN в Environment variables на Netlify'
                })
            };
        }

        // 3. Формируем промпт
        const prompt = `<|im_start|>system
Вы профессиональный ИИ-ветеринар системы "ФермAi". Отвечайте коротко на русском.
Контекст о животном: ${animalContext || 'нет данных'}<|im_end|>
<|im_start|>user
${message}<|im_end|>
<|im_start|>assistant`;

        console.log('🔄 Отправляем запрос в Hugging Face...');

        const response = await fetch(
            'https://api-inference.huggingface.co/models/microsoft/Phi-3.5-mini-instruct',
            {
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
            }
        );

        console.log('📬 Ответ от HF, статус:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ Ошибка HF:', response.status, errorText);
            return {
                statusCode: response.status,
                body: JSON.stringify({
                    error: 'Ошибка Hugging Face API',
                    status: response.status,
                    details: errorText
                })
            };
        }

        const data = await response.json();
        console.log('✅ Данные от HF получены');

        let reply = 'Извините, я не смог обработать ваш запрос.';
        if (data && data[0] && data[0].generated_text) {
            reply = data[0].generated_text.trim();
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
        console.log('💥 Ошибка в chat.js:', error.message);
        console.log('📚 Стэк:', error.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Внутренняя ошибка сервера',
                details: error.message,
                stack: error.stack
            })
        };
    }
};