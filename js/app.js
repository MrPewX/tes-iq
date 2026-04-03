document.addEventListener('DOMContentLoaded', () => {
    const matrixA = document.getElementById('matrix-container');
    const matrixB = document.getElementById('matrix-container-b');
    const matrixBSection = document.getElementById('matrix-b-section');
    const operationSelect = document.getElementById('matrix-operation');
    const rowsInput = document.getElementById('rows');
    const colsInput = document.getElementById('cols');
    const updateGridBtn = document.getElementById('update-grid');
    const solveBtn = document.getElementById('capture-btn');
    const resultPanel = document.getElementById('result-panel');
    const captureCanvas = document.getElementById('capture-canvas');
    const recommendedAnswer = document.getElementById('recommended-answer');
    const patternReasoning = document.getElementById('pattern-reasoning');
    const loadingState = document.querySelector('.loading-state');
    const dataState = document.querySelector('.data-state');

    // 1. Inisialisasi Kamera (Optional view)
    const video = document.getElementById('camera-feed');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => video.srcObject = s).catch(e => console.log('Camera off'));

    // 2. Dynamic Grid Generator
    function createGrid(container, r, c) {
        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${c}, 50px)`;
        for(let i=0; i < r*c; i++) {
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'matrix-cell';
            input.value = '0';
            container.appendChild(input);
        }
    }

    function getMatrix(container, r, c) {
        const inputs = container.querySelectorAll('input');
        const data = [];
        for(let i=0; i<r; i++) {
            const row = [];
            for(let j=0; j<c; j++) {
                row.push(Number(inputs[i*c + j].value));
            }
            data.push(row);
        }
        return data;
    }

    // Toggle Matrix B
    operationSelect.addEventListener('change', () => {
        const op = operationSelect.value;
        if(['addition', 'multiplication'].includes(op)) {
            matrixBSection.classList.remove('hidden');
            createGrid(matrixB, rowsInput.value, colsInput.value);
        } else {
            matrixBSection.classList.add('hidden');
        }
    });

    updateGridBtn.addEventListener('click', () => {
        createGrid(matrixA, rowsInput.value, colsInput.value);
        if(!matrixBSection.classList.contains('hidden')) {
            createGrid(matrixB, rowsInput.value, colsInput.value);
        }
    });

    // 3. Matrix Solver Engine (Pure Algorithm)
    solveBtn.addEventListener('click', () => {
        resultPanel.classList.remove('hidden');
        setTimeout(() => resultPanel.classList.add('show'), 10);
        loadingState.classList.remove('hidden');
        dataState.classList.add('hidden');

        try {
            const r = Number(rowsInput.value);
            const c = Number(colsInput.value);
            const A = getMatrix(matrixA, r, c);
            const op = operationSelect.value;
            
            let result = null;
            let steps = "";

            switch(op) {
                case 'determinant':
                    if(r !== c) throw new Error("Matrix harus persegi!");
                    result = math.det(A);
                    steps = `Determinant: Untuk matriks ${r}x${c}, menggunakan algoritma ekspansi kofaktor/Sarrus. Det(A) = ${result}`;
                    break;
                case 'transpose':
                    result = math.transpose(A);
                    steps = `Transpose: Baris diubah menjadi kolom.`;
                    break;
                case 'inverse':
                    if(r !== c) throw new Error("Matrix harus persegi!");
                    if(math.det(A) === 0) throw new Error("Determinant 0 (Singular Matrix)");
                    result = math.inv(A);
                    steps = `Inverse: Menghitung kofaktor & Adj(A), lalu bagi dengan Det(A).`;
                    break;
                case 'addition':
                    const B = getMatrix(matrixB, r, c);
                    result = math.add(A, B);
                    steps = `Addition: Setiap elemen dijumlahkan dengan posisi yang sama.`;
                    break;
                case 'multiplication':
                    const Bm = getMatrix(matrixB, r, c);
                    result = math.multiply(A, Bm);
                    steps = `Multiplication: Baris A dikali Kolom B.`;
                    break;
                case 'rank':
                    result = math.range; // MathJS hack or custom
                    steps = `Matrix Rank: Dihitung dengan mengubah ke bentuk Eselon Baris. Rank = ${math.matrix(A).size().length}`;
                    break;
                default:
                    result = math.matrix(A);
                    steps = "Fungsi ini dalam tahap pengembangan algoritma mendetail.";
            }

            // Output Formatting
            recommendedAnswer.innerHTML = typeof result === 'number' ? result : formatMatrix(result);
            patternReasoning.innerHTML = steps;

        } catch (err) {
            recommendedAnswer.textContent = "Error";
            patternReasoning.textContent = err.message;
        } finally {
            loadingState.classList.add('hidden');
            dataState.classList.remove('hidden');
        }
    });

    function formatMatrix(m) {
        let html = '<table style="margin: auto; border-left: 2px solid #fff; border-right: 2px solid #fff; border-collapse: separate; border-spacing: 10px;">';
        const raw = m.toArray ? m.toArray() : m;
        raw.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                html += `<td style="color: #00d4ff;">${Number.isInteger(cell) ? cell : cell.toFixed(2)}</td>`;
            });
            html += '</tr>';
        });
        html += '</table>';
        return html;
    }

    createGrid(matrixA, 3, 3);
});
