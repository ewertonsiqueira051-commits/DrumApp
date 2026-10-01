let audioContext;
let audioBuffer;
let sourceNode;
let playbackRate = 1.0;
let detune = 0;
let isPlaying = false;
let startTime = 0;
let pausedAt = 0;
let progressInterval;

const audioUpload = document.getElementById('audio-upload');
const playPauseBtn = document.getElementById('play-pause-btn');
const stopBtn = document.getElementById('stop-btn');
const speedSlider = document.getElementById('speed-slider');
const pitchSlider = document.getElementById('pitch-slider');
const speedVal = document.getElementById('speed-val');
const pitchVal = document.getElementById('pitch-val');
const progressBar = document.getElementById('progress-bar');
const currentTimeDisplay = document.getElementById('current-time');
const totalDurationDisplay = document.getElementById('total-duration');

function initAudioContext() {
    if (!audioContext) {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    }
}

audioUpload.addEventListener('change', async (event) => {
    initAudioContext();
    const file = event.target.files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        playPauseBtn.disabled = false;
        stopBtn.disabled = false;
        speedSlider.disabled = false;
        pitchSlider.disabled = false;
        progressBar.disabled = false;
        progressBar.max = audioBuffer.duration;
        progressBar.value = 0;
        totalDurationDisplay.textContent = formatTime(audioBuffer.duration);
        currentTimeDisplay.textContent = "0:00";
    } catch (err) {
        alert("Erro ao decodificar o arquivo de áudio. Tente outro formato.");
    }
});

playPauseBtn.addEventListener('click', () => {
    if (isPlaying) {
        pauseAudio();
    } else {
        playAudio();
    }
});

stopBtn.addEventListener('click', stopAudio);

speedSlider.addEventListener('input', (event) => {
    playbackRate = parseFloat(event.target.value);
    speedVal.textContent = `${playbackRate.toFixed(2)}x`;
    if (sourceNode) {
        sourceNode.playbackRate.value = playbackRate;
    }
});

pitchSlider.addEventListener('input', (event) => {
    const semitones = parseInt(event.target.value);
    detune = semitones * 100;
    pitchVal.textContent = semitones;
    if (sourceNode) {
        sourceNode.detune.value = detune;
    }
});

progressBar.addEventListener('input', (event) => {
    if (!audioBuffer) return;
    const seekTime = parseFloat(event.target.value);
    
    if (isPlaying) {
        pauseAudio();
        pausedAt = seekTime;
        playAudio();
    } else {
        pausedAt = seekTime;
        currentTimeDisplay.textContent = formatTime(seekTime);
    }
});

function playAudio() {
    if (!audioBuffer) return;

    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.value = playbackRate;
    sourceNode.detune.value = detune;
    sourceNode.connect(audioContext.destination);

    sourceNode.start(0, pausedAt);
    startTime = audioContext.currentTime - pausedAt;
    isPlaying = true;
    playPauseBtn.textContent = 'Pause';

    progressInterval = setInterval(updateProgress, 100);

    sourceNode.onended = () => {
        if (isPlaying && audioContext.currentTime - startTime >= audioBuffer.duration) {
            stopAudio();
        }
    };
}

function pauseAudio() {
    if (!sourceNode) return;
    sourceNode.stop();
    sourceNode.disconnect();
    clearInterval(progressInterval);
    pausedAt = audioContext.currentTime - startTime;
    isPlaying = false;
    playPauseBtn.textContent = 'Play';
}

function stopAudio() {
    if (sourceNode) {
        sourceNode.stop();
        sourceNode.disconnect();
    }
    clearInterval(progressInterval);
    pausedAt = 0;
    isPlaying = false;
    playPauseBtn.textContent = 'Play';
    progressBar.value = 0;
    currentTimeDisplay.textContent = "0:00";
}

function updateProgress() {
    if (!isPlaying || !audioBuffer) return;
    const currentTime = audioContext.currentTime - startTime;
    progressBar.value = currentTime;
    currentTimeDisplay.textContent = formatTime(currentTime);
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}