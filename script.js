/* JavaScript ES5: Safari antigo, FileReader e decodeAudioData com callbacks. */
(function () {
    'use strict';
    var audioContext = null;
    var audioBuffer = null;
    var sourceNode = null;
    var isPlaying = false;
    var position = 0;
    var anchorTime = 0;
    var effectiveRate = 1;
    var progressInterval = null;
    var loadId = 0;
    var activeReader = null;
    var fileName = '';
    var audioUpload = document.getElementById('audio-upload');
    var playPauseBtn = document.getElementById('play-pause-btn');
    var stopBtn = document.getElementById('stop-btn');
    var speedSlider = document.getElementById('speed-slider');
    var pitchSlider = document.getElementById('pitch-slider');
    var speedVal = document.getElementById('speed-val');
    var pitchVal = document.getElementById('pitch-val');
    var progressBar = document.getElementById('progress-bar');
    var currentTimeDisplay = document.getElementById('current-time');
    var totalDurationDisplay = document.getElementById('total-duration');
    var status = document.getElementById('status');

    function message(text, error) {
        status.textContent = text;
        status.className = error ? 'error' : '';
    }
    function enableControls(enabled) {
        playPauseBtn.disabled = !enabled;
        stopBtn.disabled = !enabled;
        speedSlider.disabled = !enabled;
        pitchSlider.disabled = !enabled;
        progressBar.disabled = !enabled;
    }
    function formatTime(seconds) {
        seconds = Math.max(0, Math.floor(seconds || 0));
        var minutes = Math.floor(seconds / 60);
        var remainder = seconds % 60;
        return minutes + ':' + (remainder < 10 ? '0' : '') + remainder;
    }
    function currentPosition() {
        var result = position;
        if (isPlaying) {
            result += (audioContext.currentTime - anchorTime) * effectiveRate;
        }
        return Math.max(0, Math.min(audioBuffer ? audioBuffer.duration : 0, result));
    }
    function drawProgress() {
        var seconds = currentPosition();
        progressBar.value = seconds;
        currentTimeDisplay.textContent = formatTime(seconds);
    }
    function detachSource() {
        clearInterval(progressInterval);
        progressInterval = null;
        if (sourceNode) {
            sourceNode.onended = null;
            try { sourceNode.stop(0); } catch (ignoreStop) {}
            try { sourceNode.disconnect(); } catch (ignoreDisconnect) {}
            sourceNode = null;
        }
    }
    function stopAudio() {
        isPlaying = false;
        detachSource();
        position = 0;
        playPauseBtn.textContent = 'Play';
        drawProgress();
    }
    function initAudioContext() {
        if (!audioContext) {
            var Context = window.AudioContext || window.webkitAudioContext;
            if (!Context) { throw new Error('Web Audio indisponível'); }
            audioContext = new Context();
        }
    }
    // Chamado diretamente no toque/clique; não depende de async/await.
    function unlockAudio() {
        initAudioContext();
        if (audioContext.resume && audioContext.state !== 'running') {
            var resumed = audioContext.resume();
            if (resumed && resumed.then) {
                resumed.then(function () {}, function () {
                    pauseAudio();
                    message('O Safari bloqueou o áudio. Toque em Play novamente.', true);
                });
            }
        }
        var silent = audioContext.createBufferSource();
        silent.buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate || 44100);
        silent.connect(audioContext.destination);
        silent.onended = function () { silent.disconnect(); };
        silent.start(0);
    }
    function pauseAudio() {
        if (!isPlaying) { return; }
        position = currentPosition();
        isPlaying = false;
        detachSource();
        playPauseBtn.textContent = 'Play';
        drawProgress();
    }
    function playAudio() {
        if (!audioBuffer || isPlaying) { return; }
        try {
            unlockAudio();
            if (position >= audioBuffer.duration) { position = 0; }
            var node = audioContext.createBufferSource();
            sourceNode = node;
            node.buffer = audioBuffer;
            // Evita depender de detune, ausente em versões antigas do Safari.
            node.playbackRate.value = effectiveRate;
            node.connect(audioContext.destination);
            node.onended = function () {
                if (sourceNode !== node || !isPlaying) { return; }
                isPlaying = false;
                clearInterval(progressInterval);
                progressInterval = null;
                node.disconnect();
                sourceNode = null;
                position = audioBuffer.duration;
                playPauseBtn.textContent = 'Play';
                drawProgress();
                message('Fim da música. Toque em Play para ouvir novamente.');
            };
            anchorTime = audioContext.currentTime;
            node.start(0, position);
            isPlaying = true;
            playPauseBtn.textContent = 'Pause';
            progressInterval = setInterval(drawProgress, 150);
            message('Reproduzindo: ' + fileName);
        } catch (error) {
            isPlaying = false;
            detachSource();
            playPauseBtn.textContent = 'Play';
            message('Não foi possível iniciar o áudio. Toque em Play novamente ou recarregue a página.', true);
        }
    }
    function updateRate() {
        // Salva a posição com a velocidade anterior antes de trocar a taxa.
        if (isPlaying) {
            position = currentPosition();
            anchorTime = audioContext.currentTime;
        }
        var speed = parseFloat(speedSlider.value);
        var semitones = parseInt(pitchSlider.value, 10);
        effectiveRate = speed * Math.pow(2, semitones / 12);
        speedVal.textContent = speed.toFixed(2) + 'x';
        pitchVal.textContent = semitones;
        if (sourceNode) { sourceNode.playbackRate.value = effectiveRate; }
        drawProgress();
    }
    audioUpload.addEventListener('change', function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) { return; }
        var thisLoad = ++loadId;
        if (activeReader && activeReader.readyState === 1) { activeReader.abort(); }
        stopAudio();
        audioBuffer = null;
        enableControls(false);
        totalDurationDisplay.textContent = '0:00';
        progressBar.max = 100;
        fileName = file.name || 'Áudio';
        speedSlider.value = 1;
        pitchSlider.value = 0;
        updateRate();
        function failed(text) {
            if (thisLoad !== loadId) { return; }
            activeReader = null;
            message(text, true);
            // Permite escolher novamente o mesmo arquivo após uma falha.
            audioUpload.value = '';
        }
        try {
            unlockAudio();
            if (!window.FileReader) { throw new Error('FileReader indisponível'); }
            if (!file.size) {
                failed('O arquivo está vazio ou indisponível. Baixe-o pelo iCloud e selecione novamente.');
                return;
            }
            message('Lendo: ' + fileName + '. Aguarde...');
            var reader = new FileReader();
            activeReader = reader;
            reader.onerror = function () {
                failed('Não foi possível ler o arquivo. Abra-o no iCloud, aguarde o download e selecione novamente.');
            };
            reader.onabort = function () { failed('Leitura cancelada. Selecione a música novamente.'); };
            reader.onload = function () {
                if (thisLoad !== loadId) { return; }
                activeReader = null;
                message('Preparando o áudio: ' + fileName + '. Aguarde...');
                try {
                    audioContext.decodeAudioData(reader.result, function (buffer) {
                        if (thisLoad !== loadId) { return; }
                        if (!buffer || !isFinite(buffer.duration) || buffer.duration <= 0) {
                            failed('O arquivo não contém áudio utilizável. Tente uma cópia em MP3.');
                            return;
                        }
                        audioBuffer = buffer;
                        position = 0;
                        progressBar.max = buffer.duration;
                        totalDurationDisplay.textContent = formatTime(buffer.duration);
                        drawProgress();
                        enableControls(true);
                        message('Pronto: ' + fileName + '. Toque em Play.');
                    }, function () {
                        failed('O Safari não conseguiu decodificar esse áudio. Tente uma cópia em MP3; se o arquivo for longo, teste um trecho menor.');
                    });
                } catch (decodeError) {
                    failed('Falha ao preparar o áudio. Tente outro arquivo ou um trecho menor.');
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (error) {
            failed('Não foi possível abrir o leitor de áudio. Recarregue no Safari e tente novamente.');
        }
    });
    playPauseBtn.addEventListener('click', function () {
        if (isPlaying) {
            pauseAudio();
            message('Pausado: ' + fileName);
        } else { playAudio(); }
    });
    stopBtn.addEventListener('click', function () {
        stopAudio();
        message('Parado. Toque em Play para recomeçar.');
    });
    speedSlider.addEventListener('input', updateRate);
    speedSlider.addEventListener('change', updateRate);
    pitchSlider.addEventListener('input', updateRate);
    pitchSlider.addEventListener('change', updateRate);
    function seek() {
        if (!audioBuffer) { return; }
        var requested = parseFloat(progressBar.value);
        var wasPlaying = isPlaying;
        pauseAudio();
        position = Math.max(0, Math.min(audioBuffer.duration, requested));
        drawProgress();
        if (wasPlaying && position < audioBuffer.duration) { playAudio(); }
    }
    progressBar.addEventListener('input', seek);
    progressBar.addEventListener('change', seek);
    enableControls(false);
}());
