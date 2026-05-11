import { useState } from "react";

export default function VoiceInput() {
  const [text, setText] = useState("");

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mediaRecorder = new MediaRecorder(stream);
    let chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });

      const formData = new FormData();
      formData.append("file", blob);

      const res = await fetch("http://localhost:3000/api/speech-to-text", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setText(data.text);
    };

    mediaRecorder.start();

    setTimeout(() => {
      mediaRecorder.stop();
    }, 4000);
  };

  return (
    <div>
      <button onClick={startRecording}>🎤 Speak</button>
      <p>{text}</p>
    </div>
  );
}