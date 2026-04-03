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
    const detectedMatrixView = document.getElementById('detected-matrix-view');
    const operationSelect = document.getElementById('matrix-operation');

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
            console.error('Camera access failed:', err);
            alert('Gagal mengakses kamera. Mohon izinkan akses kamera.');
        }
    }

    // 2. Algoritma Grid Reconstruction
    // Mengubah data OCR mentah menjadi Matriks yang valid melalui ALGORITMA kordinat
    function reconstructMatrix(words) {
        // Filter hanya angka (boleh negatif atau desimal)
        const numbers = words.filter(w => /^-?\d+([.,]\d+)?$/.test(w.text));
        if (numbers.length === 0) return null;

        // Kelompokkan dalam baris berdasarkan kordinat Y (toleransi 10% tinggi kata)
        const rows = [];
        numbers.forEach(num => {
            let found = false;
            for (let row of rows) {
                const avgY = row.reduce((sum, n) => sum + n.bbox.y0, 0) / row.length;
                if (Math.abs(num.bbox.y0 - avgY) < (num.bbox.y1 - num.bbox.y0) * 0.8) {
                    row.push(num);
                    found = true;
                    break;
                }
            }
            if (!found) rows.push([num]);
        });

        // Urutkan Baris (Atas -> Bawah)
        rows.sort((a, b) => a[0].bbox.y0 - b[0].bbox.y0);

        // Urutkan Angka dalam setiap Baris (Kiri -> Kanan)
        const matrixData = rows.map(row => {
            row.sort((a, b) => a.bbox.x0 - b.bbox.x0);
            return row.map(n => Number(n.text.replace(',', '.')));
        });

        // Normalisasi ukuran matriks agar seragam (Padding 0 jika ada baris yang ompong)
        const maxCols = Math.max(...matrixData.map(r => r.length));
        return matrixData.map(r => {
            while (r.length < maxCols) r.push(0);
            return r;
        });
    }

    // 3. Scan & Solve
    captureBtn.addEventListener('click', async () => {
        if (!stream) return;

        resultPanel.classList.remove('hidden');
        setTimeout(() => resultPanel.classList.add('show'), 10);
        loadingState.classList.remove('hidden');
        dataState.classList.add('hidden');
        document.getElementById('loading-text').textContent = "Mendeteksi susunan matriks...";

        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvas.toDataURL('image/jpeg');

        try {
            // ALGORITMA OCR Lokasi Karakter
            const engine = await Tesseract.recognize(imageData, 'eng');
            const words = engine.data.words;

            // Jalankan Algoritma Reconstruction
            const matrix = reconstructMatrix(words);
            if (!matrix) throw new Error("Gagal mengenali grid matriks. Pastikan tulisan jelas.");

            displayedDetectedMatrix(matrix);
            
            // Jalankan Algoritma Matematika (Math.js)
            const op = operationSelect.value;
            const res = solveMatrixAlgorithmic(matrix, op);

            recommendedAnswer.innerHTML = res.display;
            patternReasoning.innerHTML = res.steps;

            loadingState.classList.add('hidden');
            dataState.classList.remove('hidden');

        } catch (err) {
            recommendedAnswer.textContent = "Error";
            patternReasoning.textContent = err.message;
            loadingState.classList.add('hidden');
            dataState.classList.remove('hidden');
        }
    });

    function solveMatrixAlgorithmic(A, op) {
        const mathA = math.matrix(A);
        const rows = A.length;
        const cols = A[0].length;
        
        let result = null;
        let steps = "";

        switch(op) {
            case 'determinant':
                if (rows !== cols) throw new Error("Hanya untuk Matrix Persegi.");
                result = math.det(A);
                steps = `<b>Algoritma:</b> Ekspansi Baris/Kofaktor.<br>Penyelesaian Determinant ${rows}x${cols} menghasilkan: ${result}`;
                break;
            case 'transpose':
                result = math.transpose(A);
                steps = "<b>Algoritma:</b> Penempatan ulang elemen a_{ij} menjadi a_{ji}.";
                break;
            case 'inverse':
                if (rows !== cols) throw new Error("Hanya untuk Matrix Persegi.");
                if (math.det(A) === 0) throw new Error("Bukan Matrix Invertible (Det=0).");
                result = math.inv(A);
                steps = "<b>Algoritma:</b> Penggunaan Adjoin / Eliminasi Gauss-Jordan.";
                break;
            case 'rank':
                result = math.rank(A); // Manual implementation or simple library call
                steps = `<b>Algoritma:</b> Reduksi Baris Eselon.<br>Matrix Rank = ${result}`;
                break;
            default:
                result = mathA;
                steps = "Algoritma standar diterapkan.";
        }

        return {
            display: typeof result === 'number' ? result : formatMatrixHTML(result),
            steps: steps
        };
    }

    function formatMatrixHTML(m) {
        const raw = m.toArray ? m.toArray() : m;
        let html = '<div style="display:inline-block; border-left: 2px solid #fff; border-right: 2px solid #fff; padding: 5px;">';
        raw.forEach(r => {
            html += '<div style="display:flex; justify-content: space-around; gap: 15px; margin: 3px 0;">';
            r.forEach(c => html += `<span style="color:#00d4ff">${Number.isInteger(c) ? c : c.toFixed(2)}</span>`);
            html += '</div>';
        });
        html += '</div>';
        return html;
    }

    function displayedDetectedMatrix(m) {
        detectedMatrixView.innerHTML = `<p style="font-size:0.7rem; color:var(--text-dim); margin-bottom:5px;">Terdeteksi Matriks ${m.length}x${m[0].length}:</p>${formatMatrixHTML(m)}`;
    }

    closeResult.addEventListener('click', () => {
        resultPanel.classList.remove('show');
        setTimeout(() => resultPanel.classList.add('hidden'), 500);
    });

    initCamera();
});
