// create answer
// add stream
// 获取桌面流
const { desktopCapturer, ipcRenderer} = require('electron')

const pc = new window.RTCPeerConnection({})

async function getScreenStreamV2() {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sources[0].id,
                maxWidth: window.screen.width,
                maxHeight: window.screen.height,
            }
        }
    })
    stream.getTracks().forEach(function (track) {
        pc.addTrack(track, stream);
    });
}

// async function getScreenStream(pc) {
//     const sources = await desktopCapturer.getSources({ types: ['screen'] })
//     return new Promise((resolve, reject) => {
//         navigator.mediaDevices.getUserMedia({
//             audio: false,
//             video: {
//                 mandatory: {
//                     chromeMediaSource: 'desktop',
//                     chromeMediaSourceId: sources[0].id,
//                     maxWidth: window.screen.width,
//                     maxHeight: window.screen.height,
//                 }
//             }
//         }, (stream) => {
//             resolve(stream)
//             // peer.emit('add-stream', stream) // 触发事件
//         }, (err) => {
//             console.error(err)
//         })
//     })
// }

pc.ondatachannel = (e) => {
    console.log('datachannel', e)
    e.channel.onmessage = (e) => {
        let {type, data} = JSON.parse(e.data)
        if (type === 'mouse') {
            data.screen = {
                width: window.screen.width,
                height: window.screen.height,
            }
        }
        ipcRenderer.send('robot', type, data)
    }
} 

pc.onicecandidate = function (e) {
    console.log('candidate', JSON.stringify(e.candidate))
}

pc.onicecandidate = function (e) {
    let candidate = e.candidate
    console.log('candidate', JSON.stringify(candidate))
    if (candidate) {
        ipcRenderer.send('forward', 'puppet-candidate', candidate.toJSON())
    }
}

let candidates = [];

async function addIceCandidate(candidate) {
    if (candidate) {
        candidates.push(candidate)
    }
    if (pc.remoteDescription && pc.remoteDescription.type) {
        for (let i = 0; i < candidates.length; i++) {
            await pc.addIceCandidate(new RTCIceCandidate(candidates[i]))
        }
        candidates = []
    }
}
window.addIceCandidate = addIceCandidate

ipcRenderer.on('offer', async (e, offer) => {
    let answer = await createAnswer(offer)
    ipcRenderer.send('forward', 'answer', {type: answer.type, sdp: answer.sdp})
})

async function createAnswer(offer) {
    // 添加流
    await getScreenStreamV2()
    await pc.setRemoteDescription(offer)
    await pc.setLocalDescription(await pc.createAnswer())
    console.log('answer', JSON.stringify(pc.localDescription))
    return pc.localDescription
}

window.createAnswer = createAnswer