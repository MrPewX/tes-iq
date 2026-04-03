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

    // 1. Inisialisasi Kamera
    async function initCamera() {
        try {
            const constraints = {
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
        } catch (err) {
            console.error('Error camera:', err);
            alert('Gagal kamera. Pastikan menggunakan HTTPS/localhost.');
        }
    }

    // 2. Scan & Pecahkan dengan Algoritma Pemrograman
    captureBtn.addEventListener('click', async () => {
        if (!stream) return;

        // Show UI Loading
        resultPanel.classList.remove('hidden');
        setTimeout(() => resultPanel.classList.add('show'), 10);
        loadingState.classList.remove('hidden');
        dataState.classList.add('hidden');
        loadingState.querySelector('p').textContent = "Membaca angka & simbol...";

        // Step A: Capture Gambar ke Canvas
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvas.toDataURL('image/jpeg');

        try {
            // Step B: Gunakan Algoritma OCR (Tesseract) untuk mengekstrak teks
            // Tanpa AI Generatif/LLM, murni pengenalan pola per karakter
            const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        loadingState.querySelector('p').textContent = `Menganalisis: ${Math.round(m.progress * 100)}%`;
                    }
                }
            });

            console.log("Teks Terbaca:", text);
            
            // Step C: Pembersihan Teks Secara Algoritma (Regex)
            // Menghapus karakter non-matematika & memperbaiki simbol umum
            let mathExpression = text
                .replace(/[^0-9+\-*/().=^xX:]/g, '') // Ambil hanya simbol mtk
                .replace(/[xX:]/g, match => (match === ':' ? '/' : '*')) // Ubah x -> * dan : -> /
                .split('=')[0]; // Ambil bagian sebelum tanda '=' jika ada

            if (!mathExpression.trim()) {
                throw new Error("Tidak menemukan angka atau rumus matematika yang jelas.");
            }

            // Step D: Gunakan Mesin Algoritma Matematika (Math.js) untuk menghitung
            loadingState.querySelector('p').textContent = "Menghitung hasil...";
            const resultValue = math.evaluate(mathExpression);

            // Step E: Tampilkan Hasil
            recommendedAnswer.textContent = resultValue;
            patternReasoning.innerHTML = `
                <b>Input Terdeteksi:</b> <code style="color: #00d4ff;">${mathExpression}</code><br><br>
                <b>Metode:</b> Pemecahan Algoritma Murni (Math Engine).<br>
                <b>Status:</b> Selesai tanpa bantuan AI.
            `;
            
            loadingState.classList.add('hidden');
            dataState.classList.remove('hidden');

        } catch (err) {
            console.error(err);
            recommendedAnswer.textContent = 'Gagal';
            patternReasoning.textContent = "Kesalahan Algoritma: " + err.message + ". Pastikan tulisan soal terlihat jelas dan kontras.";
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
