import EventEmitter from 'events'
const { desktopCapturer, ipcRenderer} = require('electron')
let peer = new EventEmitter()

// 监听到 offer 指令才创建 RTCPeerConnection
ipcRenderer.on('offer', (e, offer) => {
    console.log('init pc', offer)

    const pc = new window.RTCPeerConnection({})

    // 创建响应并且转发
    createAnswer(offer).then((answer) => {
        ipcRenderer.send('forward', 'answer', { type: answer.type, sdp: answer.sdp })
    })

    //获取视频流
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

    pc.onicecandidate = function (e) { //
        if (e.candidate) {
            // 告知其他人
            console.log('candidate need to be send', JSON.stringify(e.candidate))
            ipcRenderer.send('forward', 'puppet-candidate', e.candidate.toJSON())
        }
    }

    async function addIceCandidate(candidate) {
        if (!candidate) return
        console.log('addIceCandidate success', candidate)
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
    }

    ipcRenderer.on('candidate', (e, candidate) => {
        console.log('receive a candidate', candidate)
        addIceCandidate(candidate)
    })

    async function createAnswer(offer) {
        // 添加流
        await getScreenStreamV2()
        await pc.setRemoteDescription(offer)
        await pc.setLocalDescription(await pc.createAnswer())
        console.log('create answer success', JSON.stringify(pc.localDescription))
        return pc.localDescription
    }

    // 接收控制指令
    pc.ondatachannel = (e) => {
        console.log('peer-puppet recieve order', e)
        e.channel.onmessage = (e) => {
            let { type, data } = JSON.parse(e.data)
            if (type === 'mouse') {
                data.screen = {
                    width: window.screen.width,
                    height: window.screen.height,
                }
            }
            ipcRenderer.send('robot', type, data)
        }
        e.channel.onerror = (e) => {
            console.log('peer-puppet channle error', e)
        }
    }
})

export default peer