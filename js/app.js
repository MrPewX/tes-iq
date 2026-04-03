document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('capture-canvas');
    const captureBtn = document.getElementById('capture-btn');
    const resultPanel = document.getElementById('result-panel');
    const closeResult = document.getElementById('close-result');
    const loadingState = document.querySelector('.loading-state');
    const dataState = document.querySelector('.data-state');
    const recommendedAnswer = document.getElementById('recommended-answer');
    const patternReasoning = document.getElementById('pattern-reasoning');

    let stream = null;

    // 1. Initialize Camera
    async function initCamera() {
        try {
            // Prefer back camera for mobile users
            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };
            
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
        } catch (err) {
            console.error('Error accessing camera:', err.name, err.message);
            // Memberikan pesan spesifik jika HTTPS bermasalah
            if (location.protocol === 'http:' && location.hostname !== 'localhost') {
                alert('Browser memblokir kamera di HTTP biasa. Rekomendasi: Gunakan HTTPS (seperti melalui localtunnel). Error: ' + err.message);
            } else {
                alert('Gagal mengakses kamera: ' + err.name + ' - ' + err.message);
            }
        }
    }

    // 2. Capture and Solve
    captureBtn.addEventListener('click', async () => {
        if (!stream) return;

        // Show panel and loader
        resultPanel.classList.remove('hidden');
        setTimeout(() => resultPanel.classList.add('show'), 10);
        loadingState.classList.remove('hidden');
        dataState.classList.add('hidden');

        // Capture frame
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        try {
            // Process with AI (Vercel API)
            const response = await fetch('/api/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData })
            });

            const result = await response.json();

            if (result.success) {
                recommendedAnswer.textContent = result.answer;
                patternReasoning.textContent = result.reasoning;
                
                loadingState.classList.add('hidden');
                dataState.classList.remove('hidden');
            } else {
                throw new Error(result.message || 'Gagal menganalisis soal.');
            }

        } catch (err) {
            recommendedAnswer.textContent = 'ERROR';
            patternReasoning.textContent = err.message || 'Terjadi kesalahan sistem. Coba lagi.';
            loadingState.classList.add('hidden');
            dataState.classList.remove('hidden');
        }
    });

    closeResult.addEventListener('click', () => {
        resultPanel.classList.remove('show');
        setTimeout(() => resultPanel.classList.add('hidden'), 500);
    });

    initCamera();
});
