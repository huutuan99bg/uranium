# %%
import os
import signal
import sys
import socket
import uuid
import argparse
import nest_asyncio
import socketio
import asyncio
from contextlib import closing
from aiohttp import web, streamer
from threading import Thread
from asyncio import Future
import shutil

sio = socketio.AsyncServer(async_mode='aiohttp', cors_allowed_origins='*')
app = web.Application()
sio.attach(app)
server_pid = None


class BrowserManager():
    def __init__(self):
        self.clients = {}

    def register(self, client, sid):
        self.clients[client] = sid

    def sid(self, client):
        try:
            return self.clients[client]
        except:
            return None

    def logout(self, client):
        try:
            del self.clients[client]
            return True
        except:
            return False


class DriverManager():
    def __init__(self):
        self.drivers = []
        self.start = False

    def register(self, data, sid):
        self.start = True
        try:
            if len([d for d in self.drivers if d['sid'] == sid]) > 0:
                driver = [d for d in self.drivers if d['sid'] == sid]
                self.drivers[self.drivers.index(driver[0])]['client_id'] = data['client_id']
                self.drivers[self.drivers.index(driver[0])]['profile_dir'] = data['profile_dir']
            else:
                self.drivers.append({
                    'client_id': data['client_id'],
                    'profile_dir': data['profile_dir'],
                    'sid': sid,
                })
        except:
            pass
        # print(self.drivers)

    def get_driver(self, sid):
        return len([d for d in self.drivers if d['sid'] == sid]) > 0

    def get_client_id(self, sid):
        driver = [d for d in self.drivers if d['sid'] == sid]
        return self.drivers[self.drivers.index(driver[0])]['client_id']

    def get_profile_dir(self, sid):
        driver = [d for d in self.drivers if d['sid'] == sid]
        return self.drivers[self.drivers.index(driver[0])]['profile_dir']
    def get_profile_dir_by_client(self, client_id):
        driver = [d for d in self.drivers if d['client_id'] == client_id]
        return self.drivers[self.drivers.index(driver[0])]['profile_dir']
    def drivers_status(self):
        if self.start == False or len(self.drivers) > 0:
            return True
        else:
            return False

    def logout(self, sid):
        try:
            driver = [d for d in self.drivers if d['sid'] == sid]
            client_id = self.drivers[self.drivers.index(driver[0])]['client_id']
            del self.drivers[self.drivers.index(driver[0])]
            return client_id
        except:
            return False


brs = BrowserManager()
drv = DriverManager()


async def send_command_event(target, data):
    future = Future()
    command_id = uuid.uuid4().hex
    data['command_id'] = command_id
    await sio.emit('command', data, room=brs.sid(target))

    @sio.event
    async def command_res(sid, data):
        if data['command_id'] == command_id:
            future.set_result(data)
    return future

routes = web.RouteTableDef()


@routes.get('/command')
async def send_command(request):
    try:
        data = await request.json()
        target = data['target']
        timeout = data['timeout']
        result = await send_command_event(target=target, data=data)
        return web.json_response(await asyncio.wait_for(result, timeout=timeout))
    except Exception as e:
        return web.json_response({'status': False, 'message': 'Error command'})


@routes.get('/quit')
async def quit_browser(request):
    try:
        data = await request.json()
        target = data['target']
        await sio.emit('quit', data, room=brs.sid(target))
        counter = 0
        while counter > 30:
            if brs.sid(target) == None:
                break
            await sio.sleep(0.1)
            counter += 0.1
        return web.json_response({'status': True, 'message': 'Close browser successfully'})
    except Exception as e:
        return web.json_response({'status': False, 'message': 'Error command'})


@routes.get('/client')
async def get_client(request):
    try:
        data = await request.json()
        target = data['target']
        return web.json_response({'status': True, 'client': brs.clients[target]})
    except Exception as e:
        return web.json_response({'status': False, 'message': 'Error command'})


@routes.get('/get-drivers')
async def get_client(request):
    try:
        return web.json_response({'status': True, 'drivers': drv.drivers})
    except Exception as e:
        return web.json_response({'status': False, 'message': 'Error command'})


@routes.get('/wait-client')
async def wait_client(request):
    try:
        data = await request.json()
        target = data['target']
        timeout = data['timeout']
        counter = 0
        client = None
        while counter <= timeout:
            try:
                client = brs.clients[target]
                if client != None:
                    break
            except:
                await asyncio.sleep(0.02)
                counter += 0.02
        return web.json_response({'status': True, 'message': 'Client already connected', 'client': client})
    except Exception as e:
        return web.json_response({'status': False, 'message': 'Error command'})

@streamer
async def file_sender(writer, file_path=None):
    with open(file_path, 'rb') as f:
        chunk = f.read(2 ** 16)
        while chunk:
            await writer.write(chunk)
            chunk = f.read(2 ** 16)

@routes.get('/uranium-load-file')
async def uranium_load_file(request):
    try:
        path = request.rel_url.query['path']+r''
        if not os.path.exists(path):
            return False
        filename = os.path.basename(path)
        headers = {
            "Content-disposition": "attachment; filename={file_name}".format(file_name=filename),
        }
        return web.Response(
            body=file_sender(file_path=path),headers=headers
        )
    except Exception as e:
        print(e)
        return web.json_response({'status': False, 'message': 'Error command'})

@sio.event
async def register(sid, data):
    if data['client']:
        brs.register(data['client'], sid)


@sio.event
async def driver_register(sid, data):
    drv.register(data, sid)
    print(drv.drivers)


@sio.event
async def connect(sid, environ):
    await sio.emit('connect_response', {'data': 'Connected', 'count': 0}, room=sid)


@sio.event
async def disconnect(sid):
    try:
        if drv.get_driver(sid) == True:
            client_id = drv.get_client_id(sid)
            if client_id is not None:
                await sio.emit('quit', {}, room=brs.sid(client_id))
                counter = 0
                while counter > 30:
                    if brs.sid(client_id) == None:
                        break
                    counter += 0.1
                    await asyncio.sleep(.5)
            drv.logout(sid)
            drivers_status = drv.drivers_status()
            if drivers_status == False:
                os.kill(os.getpid(), signal.SIGTERM)
        else:
            client_id = list(brs.clients.keys())[list(brs.clients.values()).index(sid)]
            brs.logout(client_id)
    except:
        pass


async def index(request):
    return web.json_response({'status': True, 'message': 'Api working'})



app.router.add_get('/', index)
app.add_routes(routes)
nest_asyncio.apply()


def server_task(server_port):
    web.run_app(app, host='127.0.0.1', port=server_port)


def get_free_port():
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(('', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


server_task(sys.argv[1])
