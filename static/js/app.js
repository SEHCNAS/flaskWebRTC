mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302'
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let roomDialog = null;
let roomId = null;

function init() {
  document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
  document.querySelector('#createBtn').addEventListener('click', createRoom);

  // Abra o diálogo ao clicar em "Join room"
  document.querySelector('#joinBtn').addEventListener('click', () => {
    roomDialog.open();
  });

  // Capturar o evento de confirmação do diálogo e chamar `joinRoomById`
  document.querySelector('#confirmJoinBtn').addEventListener('click', () => {
    const roomId = document.querySelector('#room-id').value;
    if (roomId) {
      joinRoomById(roomId);
    }
  });

  roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
}


async function createRoom() {
  console.log('Create PeerConnection with configuration:', configuration);
  peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListeners();

  // Adicionar tracks ao PeerConnection (garanta que localStream já esteja definido)
  if (localStream) {
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
  } else {
    console.error('localStream is not defined');
  }

  // Listener para o stream remoto
    peerConnection.ontrack = event => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
    };

  // Criação da coleção para armazenar temporariamente os ICE candidates
  let iceCandidatesCollection = [];

  // Configurar o evento para capturar candidatos ICE
  peerConnection.addEventListener('icecandidate', event => {
    if (event.candidate) {
      console.log('Got candidate:', event.candidate);
      iceCandidatesCollection.push(event.candidate);
    } else {
      console.log('All ICE candidates have been sent');
    }

    /*if (event.candidate) {
      console.log('Got candidate:', event.candidate);
      // Verifique se roomId foi corretamente atribuído antes de enviar os candidatos
      if (roomId) {
        fetch(`/save_ice_candidate/${roomId}/caller`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate: event.candidate })
        });
      } else {
        console.error('Room ID is not defined. Cannot save ICE candidate.');
      }
    } else {
      console.log('All ICE candidates have been sent');
    }*/
  });

  // Criar oferta e definir localDescription
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  console.log('Created offer:', offer);

  // Salvar a oferta e criar a sala no servidor
  const response = await fetch('/create_room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offer: offer.sdp })
  });

  const data = await response.json();
  roomId = data.room_id;  // Certifique-se de que roomId é atribuído aqui
  console.log(`New room created. Room ID: ${roomId}`);
  document.querySelector('#currentRoom').innerText = `Current room is ${roomId} - You are the caller!`;

  // Agora que temos o roomId, percorrer a coleção e salvar os ICE candidates no servidor
  for (let candidate of iceCandidatesCollection) {
    console.log('Inseri candidate' + candidate)
    await fetch(`/save_ice_candidate/${roomId}/caller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate: candidate })

    });
  }

  // Limpar a coleção após salvar todos os candidatos
  iceCandidatesCollection = [];

   await handleAnswerFromCallee(roomId);

   await listenForRemoteICECandidates(roomId, 'callee');
}


async function openUserMedia(e) {
  const stream = await navigator.mediaDevices.getUserMedia(
      {video: true, audio: true});
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;
  remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = remoteStream;

  console.log('Stream:', document.querySelector('#localVideo').srcObject);
  document.querySelector('#cameraBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = false;
  document.querySelector('#createBtn').disabled = false;
  document.querySelector('#hangupBtn').disabled = false;
}

async function listenForRemoteICECandidates(roomId, role) {
  const response = await fetch(`/get_ice_candidates/${roomId}/${role}`);
  const candidates = await response.json();

  for (const candidate of candidates) {
    const formattedCandidateDatajson = candidate.replace(/'/g, '"');
    const candidateData = JSON.parse(formattedCandidateDatajson);
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
  }
}

function registerPeerConnectionListeners() {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(`ICE gathering state changed: ${peerConnection.iceGatheringState}`);
  });

  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
  });

  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  peerConnection.addEventListener('iceconnectionstatechange', () => {
    console.log(`ICE connection state change: ${peerConnection.iceConnectionState}`);
  });
}

async function joinRoomById(roomId) {
  // Busca a sala e a oferta no banco de dados
  const roomResponse = await fetch(`/get_room/${roomId}`);
  const roomData = await roomResponse.json();

  // Certifique-se de que roomData.offer tem o formato correto
  let candidateData;
  if (roomData && roomData.offer) {
    console.log('Create PeerConnection with configuration:', configuration);
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();

    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    } else {
      console.error('localStream is not defined');
    }

    // Listener para o stream remoto
  peerConnection.ontrack = event => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
  };

    // Criar a descrição da sessão remota com o formato correto
    const offer = {
      type: 'offer',  // Certifique-se de que 'type' seja 'offer'
      sdp: roomData.offer  // O SDP vem do servidor
    };

    console.log('Got offer:', offer);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Cria uma resposta (answer) e a envia para o servidor
    const answer = await peerConnection.createAnswer();
    console.log('Created answer:', answer);
    await peerConnection.setLocalDescription(answer);

    await fetch(`/save_answer/${roomId}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({sdp: answer.sdp})
    });

    // Recuperar e adicionar candidatos ICE do caller após configurar a sessão remota
    const iceCandidatesResponse = await fetch(`/get_ice_candidates/${roomId}/caller`);
    const candidates = await iceCandidatesResponse.json();

    /*candidates.forEach(async candidate => {
      console.log(`Adding ICE candidate from caller: ${JSON.stringify(candidate)}`);
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });*/
    for (const candidateDatajson of candidates) {
      const formattedCandidateDatajson = candidateDatajson.replace(/'/g, '"');
      const candidateData = JSON.parse(formattedCandidateDatajson);
      /*try {
        console.log('candidateDatajson', candidateDatajson)
        const formattedCandidateDatajson = candidateDatajson.replace(/'/g, '"');
        const candidateData = JSON.parse(formattedCandidateDatajson);
        console.log('candidateData:', candidateData);
        console.log('candidateData.candidate:', candidateData.candidate);
        console.log('candidateData.sdpMid:', candidateData.sdpMid);
        console.log('candidateData.sdpMLineIndex:', candidateData.sdpMLineIndex);
        if(candidateData.sdpMid !== null && candidateData.sdpMLineIndex !== null){

        }
      } catch (error) {
        console.error('Error processing candidateData:', error);
      }*/
      /*const candidate = {

        candidate: candidateData.candidate,
        sdpMid: candidateData.sdpMid,
        sdpMlineIndex: candidateData.sdpMlineIndex
      };

      console.log("Candidate Data:", candidate); // Verifique o formato*/
      if(candidateData.sdpMid !== null && candidateData.sdpMLineIndex !== null) {
        console.log('Adiciona ice Candidate')
        const iceCandidate = new RTCIceCandidate(candidateData);
        console.log('Sending ICE candidate to server:', candidateData);
        fetch(`/save_ice_candidate/${roomId}/callee`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({candidate: candidateData})
        })

        await peerConnection.addIceCandidate(iceCandidate);

      }

    }

    // Coletar e enviar candidatos ICE do callee para o servidor
    peerConnection.addEventListener('icecandidate', event => {
      console.log('Sending ICE candidate to server:', event.candidate);
      if (event.candidate) {
        console.log('Sending ICE candidate to server:', event.candidate);
        fetch(`/save_ice_candidate/${roomId}/callee`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({candidate: event.candidate})
        });
      }
    });
  } else {
    console.error('Room not found or invalid offer received.');
  }
  await listenForRemoteICECandidates(roomId, 'caller');
}

async function handleAnswerFromCallee(roomId) {
  /*const response = await fetch(`/get_answer/${roomId}`);
  const data = await response.json();
  console.log('Checking SDP format before setting remote description...');
  console.log('data.sdp', data.sdp)*/
  /*if (data.sdp == null) {
    console.error('Invalid SDP format:', data.sdp);
  } else {
    const answer = new RTCSessionDescription({
    type: 'answer',
    sdp: data.sdp
  });

  await peerConnection.setRemoteDescription(answer);
  console.log('Caller set remote description with answer:', answer);
}*/
  const checkInterval = 1000; // Intervalo de tempo em milissegundos (1 segundo)
  const maxAttempts = 60; // Número máximo de tentativas (por exemplo, 60 segundos)
  let attempts = 0;

  const intervalId = setInterval(async () => {
    const response = await fetch(`/get_answer/${roomId}`);
    const data = await response.json();
    console.log('Checking SDP format before setting remote description...');
    console.log('data.sdp', data.sdp)
    if (data.sdp != null) {
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: data.sdp
      });

      // Lógica para processar a resposta recebida
      console.log('SDP recebido e válido:', data.sdp);
      await peerConnection.setRemoteDescription(answer);
      console.log('Caller set remote description with answer:', answer);

      // Conexão bem-sucedida, então limpa o intervalo para parar a repetição
      clearInterval(intervalId);
    } else {
      attempts++;
      console.log(`Tentativa ${attempts}: Aguardando SDP...`);

      if (attempts >= maxAttempts) {
        console.error('Não foi possível obter um SDP válido no tempo limite.');
        clearInterval(intervalId); // Para a repetição após o número máximo de tentativas
      }
    }
  }, checkInterval);

}


init();
