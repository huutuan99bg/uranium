# %%
import socket
import subprocess
from contextlib import closing
from time import time, sleep
import json
import uuid
import os
import sys
import requests
import shutil
from os.path import dirname, join
from requests.exceptions import Timeout
import socketio

curdir = dirname(__file__)


def get_free_port():
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(('', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


SERVER_PORT = get_free_port()
server_path = join(curdir, 'uranium_server.py')
cmd = 'python '+server_path+' '+str(SERVER_PORT)
server_process = subprocess.Popen(cmd, shell=True)
print('Server pid: '+str(server_process.pid))
print('Uranium server port: '+str(SERVER_PORT))


""" ================================================================= """
""" ======================= WebElement class ======================== """
""" ================================================================= """


class WebElement():
    """ Response a Dom element """

    def __init__(self, element, command, tab_id,):
        try:
            del element['method']
            del element['execute_time']
        except:
            pass
        self.element = element
        self.tab_id = tab_id
        self.command = command

    @property
    def text(self):
        """The text of the element."""
        try:
            return self.element['text']
        except:
            return None

    @property
    def html(self):
        """The html content of the element."""
        try:
            return self.element['html']
        except:
            return None

    @property
    def value(self):
        try:
            return self.element['value']
        except:
            return None

    @property
    def is_enabled(self):
        try:
            return self.element['is_enabled']
        except:
            return None

    def get_attribute(self, attribute_name):
        """
        Args:
            - name - Name of the attribute/property to retrieve.
        """
        try:
            return self.element['attributes'][attribute_name]
        except:
            return None

    def click(self, timeout=60):
        try:
            response = self.command({
                'method': 'click',
                'params': {'element': self.element, 'tab_id': self.tab_id},
                'timeout': timeout
            })
            return response['data']
        except:
            return False

    def send_keys(self, text, timeout=60, replace=False):
        try:
            response = self.command({
                'method': 'send_keys',
                'params': {
                    'element': self.element,
                    'text': text,
                    'replace': replace,
                    'tab_id': self.tab_id
                },
                'timeout': timeout
            })
            return response['data']
        except:
            return False

    def select_option(self, value, timeout=60):
        try:
            response = self.command({
                'method': 'select_option',
                'params': {
                    'element': self.element,
                    'value': value,
                    'tab_id': self.tab_id
                },
                'timeout': timeout
            })
            return response['data']
        except:
            return False

    def upload_file(self, path, timeout=60):
        try:
            response = self.command({
                'method': 'upload_file',
                'params': {
                    'element': self.element,
                    'path': path,
                    'tab_id': self.tab_id
                },
                'timeout': timeout
            })
            return response['data']
        except:
            return False


""" ================================================================= """
""" ========================= SwitchTo class ======================== """
""" ================================================================= """


class SwitchTo:
    def __init__(self, command):
        self.command = command

    def default_content(self):
        try:
            response = self.command({
                'method': 'switch_to_default_content',
                'params': {}
            })
            return response['data']
        except:
            return False

    def frame(self, frame):
        try:
            response = self.command({
                'method': 'switch_to_frame',
                'params': {'frame': frame.element}
            })
            return response['data']
        except Exception as e:
            print(e)
            return False

    def window(self, window):
        try:
            response = self.command({
                'method': 'switch_to_window',
                'params': {'window': window}
            })
            return response['data']
        except:
            return False


""" ================================================================= """
""" ========================= Options class ========================= """
""" ================================================================= """


class Options:
    def __init__(self):
        self._execute_path = None
        self._profile_path = None
        self._proxy = None
        self._images = True
        self._audio = True
        self._extensions = []
        self._chrome_args = []
        self._binary_auto = False

    @property
    def execute_path(self):
        return self._execute_path

    @execute_path.setter
    def execute_path(self, path):
        self._execute_path = path

    @property
    def profile_path(self):
        return self._profile_path

    @profile_path.setter
    def profile_path(self, path):
        self._profile_path = path

    @property
    def proxy(self):
        return self._proxy

    @proxy.setter
    def proxy(self, proxy):
        self._proxy = proxy

    @property
    def images(self):
        return self._images

    @images.setter
    def images(self, option: bool):
        self._images = option

    @property
    def audio(self):
        return self._audio

    @audio.setter
    def audio(self, option: bool):
        self._audio = option

    @property
    def extensions(self):
        return self._extensions

    @extensions.setter
    def extensions(self, extensions_path: list):
        self._extensions = extensions_path

    @property
    def chrome_args(self):
        return self._chrome_args

    def add_arguments(self, chrome_arg: str):
        self._chrome_args.append(chrome_arg)

    @property
    def binary_auto(self):
        return self._binary_auto

    @binary_auto.setter
    def binary_auto(self, option: bool):
        self._binary_auto = option


""" ================================================================= """
""" ========================= Driver class ========================== """
""" ================================================================= """


class Driver:
    def __init__(self, tab_id=None):
        self.tab_id = tab_id

    def command(self, params, timeout=30):
        """ Send command to Uranium remote server """
        try:
            # print(params)
            start_ts = time()
            data = {
                'target': self.client_id,
                'command': params,
                'timeout': timeout
            }
            res_json = requests.get('http://127.0.0.1:'+str(SERVER_PORT)+'/command', json=data, timeout=timeout).json()
            try:
                if res_json['data'] == dict:
                    res_json['data']['execute_time'] = round(time()-start_ts, 3)
                    res_json['data']['method'] = params['method']
            except:
                pass
            # print(res_json)
            return res_json
        except Timeout:
            # print('Command timeout: '+params['method'])
            return None
        except Exception as e:
            print(e)
            return None

    def wait_client(self):
        try:

            data = {
                'target': self.client_id,
                'timeout': 3
            }
            res_json = requests.get('http://127.0.0.1:'+str(SERVER_PORT)+'/wait-client', json=data, timeout=3).json()
            return res_json
        except Timeout:
            print('Open browser timeout')
            return False
        except:
            return False
# Go to page

    def get(self, url: str, timeout=60):
        """ Direct to url in the current tab. """
        try:

            response = self.command({
                'method': 'get',
                'params': {
                    'url': url,
                    'tab_id': self.tab_id,
                }
            }, timeout=timeout)
            return response['data']
        except:
            return False

# Tab information
    @property
    def url(self):
        """Get current tab url"""
        response = self.command({
            'method': 'url',
            'params': {'tab_id': self.tab_id, }
        })
        return response['data']

    @property
    def title(self):
        """Get current tab url"""
        response = self.command({
            'method': 'title',
            'params': {'tab_id': self.tab_id, }
        })
        return response['data']
# Dom

    def get_element_by_xpath(self, xpath: str, timeout=10, wait=True):
        """ Finds an element by xpath.
            Args:
                xpath: str - xpath of the element to be found.
                wait: bool - wait for the element exist.
        """
        try:
            response = self.command({
                'method': 'get_element_by_xpath',
                'params': {
                    'xpath': xpath,
                    'wait': wait,
                    'timeout': timeout,
                    'tab_id': self.tab_id,
                },
            }, timeout=timeout)
            if response == None or len(response['data']) < 1:
                return None

            return WebElement(response['data'], self.command, self.tab_id)
        except:
            return None

    def get_element_by_id(self, id: str, timeout=10, wait=True):
        """ Finds an element by id.
            Arg:
                id: str - id of the element to be found.
                wait: bool - wait for the element exist.
        """
        response = self.command({
            'method': 'get_element_by_id',
            'params': {
                'id': id,
                'wait': wait,
                'timeout': timeout,
                'tab_id': self.tab_id,
            },
        }, timeout=timeout)
        if response == None or len(response['data']) < 1:
            return None
        return WebElement(response['data'], self.command, self.tab_id)

    def get_element_by_selector(self, selector: str, timeout=10, wait=True):
        """ Finds an element by selector.
            Args:
                selector: str - selector of the element to be found.
                wait: bool - wait for the element exist.
        """
        response = self.command({
            'method': 'get_element_by_selector',
            'params': {
                'selector': selector,
                'wait': wait,
                'timeout': timeout,
                'tab_id': self.tab_id,
            }
        }, timeout=timeout)
        if response == None or len(response['data']) < 1:
            return None
        return WebElement(response['data'], self.command, self.tab_id)

    def get_elements_by_xpath(self, xpath: str, timeout=10, wait=True):
        """ Finds multiple elements by xpath.
            Args:
                xpath: str - xpath of the elements to be found.
                wait: bool - wait for the element exist.
        """
        response = self.command({
            'method': 'get_elements_by_xpath',
            'params': {
                'xpath': xpath,
                'wait': wait,
                'timeout': timeout,
                'tab_id': self.tab_id,
            }
        }, timeout=timeout)
        if response == None or len(response['data']) < 1:
            return None
        elements = []
        for element_info in response['data']:
            elements.append(WebElement(element_info, self.command, self.tab_id))
        return elements

    def get_elements_by_selector(self, selector: str, timeout=10, wait=True):
        """ Finds multiple elements by selector.
            Args:
                selector: str - selector of the elements to be found.
                wait: bool - wait for the element exist.
        """
        response = self.command({
            'method': 'get_elements_by_selector',
            'params': {
                'selector': selector,
                'wait': wait,
                'timeout': timeout,
                'tab_id': self.tab_id,
            }
        }, timeout=timeout)
        if response == None or len(response['data']) < 1:
            return []
        elements = []
        for element_info in response['data']:
            elements.append(WebElement(element_info, self.command, self.tab_id))
        return elements

    def get_element_by_xpaths(self, xpaths: list, timeout=10, wait=True):
        """ Finds multiple elements by list xpaths.
            Args:
                xpaths: str - xpath of the elements to be found.
                wait: bool - wait for the element exist.
        """
        response = self.command({
            'method': 'get_elements_by_xpaths',
            'params': {
                'xpaths': xpaths,
                'wait': wait,
                'timeout': timeout,
                'tab_id': self.tab_id,
            }
        }, timeout=timeout)
        if response == None or len(response['data']) < 1:
            return None
        elements = []
        for element_info in response['data']:
            elements.append(WebElement(element_info, self.command, self.tab_id))
        return elements
# Actions

    def add_bookmark(self, url: str, title: str = None):
        """ Add link to boomark.
            Args:
                link: str - url add to bookmark.
        """
        response = self.command({
            'method': 'add_bookmark',
            'params': {
                'url': url,
                'title': title,
            },
        })
        return response

    def click_by_xpath(self, xpath: str, timeout=10, wait=True):
        """ Click an element by xpath.
            Args:
                xpath: str - xpath of the element to be found.
                wait: bool - wait for the element exist.
        """
        response = self.command({
            'method': 'get_element_by_xpath',
            'params': {
                'xpath': xpath,
                'wait': wait,
                'timeout': timeout,
                'tab_id': self.tab_id,
            },
        }, timeout=timeout)
        if response == None or response.get('data') < 1:
            return None
        element = WebElement(response['data'], self.command, self.tab_id)
        return element.click()

    def click_by_id(self, id: str, timeout=10, wait=True):
        """ Click an element by id.
            Arg:
                id: str - id of the element to be found.
                wait: bool - wait for the element exist.
        """
        response = self.command({
            'method': 'get_element_by_id',
            'params': {
                'id': id,
                'wait': wait,
                'timeout': timeout,
                'tab_id': self.tab_id,
            },
        }, timeout=timeout)
        if response == None or len(response['data']) < 1:
            return None
        element = WebElement(response['data'], self.command, self.tab_id)
        return element.click()

    def click_by_selector(self, selector: str, timeout=10, wait=True):
        """ Click an element by selector.
            Args:
                selector: str - selector of the element to be found.
                wait: bool - wait for the element exist.
        """
        response = self.command({
            'method': 'get_element_by_selector',
            'params': {
                'selector': selector,
                'wait': wait,
                'timeout': timeout,
                'tab_id': self.tab_id,
            }
        }, timeout=timeout)
        if response == None or len(response['data']) < 1:
            return None
        element = WebElement(response['data'], self.command, self.tab_id)
        return element.click()

    def send_keys_by_xpath(self, xpath: str, text: str, timeout=10, replace=False, wait=True):
        """ Simulates typing into the element using xpath.
            Args:
                xpath: str - xpath of the element to be found.
                text: str - a string to typing into the element
                replace: bool - optional replace string in the element
                wait: bool - wait for the element exist.
        """
        response = self.command({
            'method': 'get_element_by_xpath',
            'params': {
                'xpath': xpath,
                'wait': wait,
                'timeout': timeout,
                'tab_id': self.tab_id,
            },
        }, timeout=timeout)
        if response == None or len(response['data']) < 1:
            return None
        element = WebElement(response['data'], self.command, self.tab_id)
        return element.send_keys(text, timeout=timeout, replace=replace)

    def send_keys_by_id(self, id: str, text: str, timeout=10, replace=False, wait=True):
        """ Simulates typing into the element using id.
            Args:
                id: str - id of the element to be found.
                text: str - a string to typing into the element
                replace: bool - optional replace string in the element
                wait: bool - wait for the element exist.
        """
        response = self.command({
            'method': 'get_element_by_id',
            'params': {
                'id': id,
                'wait': wait,
                'timeout': timeout,
                'tab_id': self.tab_id,
            },
        }, timeout=timeout)
        if response == None or len(response['data']) < 1:
            return None
        element = WebElement(response['data'], self.command, self.tab_id)
        return element.send_keys(text, timeout=timeout, replace=replace)

    def send_keys_by_selector(self, selector: str, text: str, timeout: int = 10, replace: bool = False, wait: bool = True):
        """ Simulates typing into the element using selector.
            Args:
                selector: str - selector of the element to be found.
                text: str - a string to typing into the element
                replace: bool - optional replace string in the element
                wait: bool - wait for the element exist.
        """
        response = self.command({
            'method': 'get_element_by_selector',
            'params': {
                'selector': selector,
                'wait': wait,
                'timeout': timeout,
                'tab_id': self.tab_id,
            },
        }, timeout=timeout)
        if response == None or len(response['data']) < 1:
            return None
        element = WebElement(response['data'], self.command, self.tab_id)
        return element.send_keys(text, timeout=timeout, replace=replace)

# Window handles

    @property
    def current_window_handle(self):
        """ Returns the handle of the current window. """
        response = self.command({
            'method': 'current_window_handle',
            'params': {'tab_id': self.tab_id, },
        })
        return response['data']

    @property
    def window_handles(self):
        """ Returns the handles of all windows """
        response = self.command({
            'method': 'window_handles',
            'params': {'query': {}},
        })
        return response['data']

    def set_window_state(self, width: int, height:int, left = None, top = None):
        """
        Args:
            width: int
            height: int
        """
        response = self.command({
            'method': 'set_window_state',
            'params': {
                'width': width,
                'height': height,
                'left': left,
                'top': top,
            }
        })
        return response['data']

    def maximize_window(self, ):
        response = self.command({
            'method': 'maximize_window',
            'params': {}
        })
        return response['data']

    def minimize_window(self, ):
        response = self.command({
            'method': 'minimize_window',
            'params': {}
        })
        return response['data']

    def window_handles_query(self, query: dict = {}):
        """
        Query params(arg query):
            active: Boolean
            currentWindow: Boolean
            index: Boolean
            status: str options unloaded|loading|complete
            url: str with URL parterns
        """
        response = self.command({
            'method': 'window_handles',
            'params': {'query': query}
        })
        return response['data']

    def close_another(self):
        """
        Arg: window_handle: dictionary - get from window_handles/current_window_handle. This function will close all tabs and keep a window_handle
        """
        response = self.command({
            'method': 'close_another',
            'params': {},
        })
        return response['data']

    def close(self):
        """ Close curent tab """
        response = self.command({
            'method': 'close_curent',
            'params': {'tab_id': self.tab_id, },
        })
        return response['data']

    def refresh(self):
        """ refresh curent tab """
        response = self.command({
            'method': 'refresh',
            'params': {'tab_id': self.tab_id, },
        })
        return response['data']

    def active(self):
        """ active tab """
        response = self.command({
            'method': 'active',
            'params': {'tab_id': self.tab_id, },
        })
        return response['data']

    def quit(self):
        """ Quit browser """
        try:
            start_ts = time()
            data = {
                'target': self.client_id,
            }
            res_json = requests.get('http://127.0.0.1:'+str(SERVER_PORT)+'/quit', json=data, timeout=30).json()
            res_json['quit_time'] = round(time()-start_ts, 3)
            try:
                self.remove_config_extension()
            except:
                pass
            return res_json
        except Exception as e:
            print(e)
            return False

    def create_tab(self, url=None, index=None, active=True, new_tab=None):
        """ Create new tab """
        response = self.command({
            'method': 'create_tab',
            'params': {
                'url': url,
                'index': index,
                'active': active,
                'new_tab': new_tab,
            },
        })
        return response['data']

    def prevent_popup(self, option: bool):
        """ Prevent popup open """
        response = self.command({
            'method': 'prevent_popup',
            'params': {'mode': option},
        })
        return response['data']
# Browser data

    def page_source(self):
        """ Returns a dictionary of cookies from current tab or custom domain"""
        response = self.command({
            'method': 'page_source',
            'params': {'tab_id': self.tab_id, },
        })
        return response['data']

    def get_cookies(self, domain: str = None):
        """ Returns a dictionary of cookies from current tab or custom domain"""
        response = self.command({
            'method': 'get_cookies',
            'params': {'domain': domain, 'tab_id': self.tab_id, },
        })
        return response['data']

    def set_cookie(self, cookie: dict):
        """ Returns a dictionary of cookies from current tab or custom domain
            Args:
                cookie (dict): dictionary of cookies with cookie format
        """
        response = self.command({
            'method': 'set_cookie',
            'params': {'cookie': cookie, 'tab_id': self.tab_id, },
        })
        return response['data']

    def set_cookies(self, cookies: list):
        """ Returns a dictionary of cookies from current tab or custom domain
            Args:
                cookies (list): list dictionary of cookies with cookies format
        """
        response = self.command({
            'method': 'set_cookies',
            'params': {'cookies': cookies, 'tab_id': self.tab_id, },
        })
        return response['data']

    def get_local_storage(self):
        """ Returns a dictionary of localstorage from current tab """
        response = self.command({
            'method': 'get_local_storage',
            'params': {'tab_id': self.tab_id, },
        })
        return response['data']

    def set_local_storage(self, key: str, value: str):
        """ Set a value to localstorage on current tab """
        response = self.command({
            'method': 'set_local_storage',
            'params': {'key': key, 'value': value, 'tab_id': self.tab_id, },
        })
        return response['data']

    def remove_browser_data(self, since: str = 'hour'):
        """ Remove browsing data
            Args:
                since (str, optional): hour|day|week|month|all
        """
        response = self.command({
            'method': 'remove_browser_data',
            'params': {'since': since},
        })
        return response
# Scripting

    def execute_script(self, script: str):
        """ Execute the javascript"""
        try:
            response = self.command({
                'method': 'execute_script',
                'params': {'script': script, 'tab_id': self.tab_id, },
            })
            return response['data'][0]
        except:
            return None
# Tagging

    def add_tag(self, tag_content, tag_name='uranium-tag'):
        """ Execute the javascript"""
        try:
            response = self.command({
                'method': 'add_tag',
                'params': {
                    'tag_content': tag_content,
                    'tag_name': tag_name,
                    'tab_id': self.tab_id,
                },
            })
            return response['data'][0]
        except:
            return None


""" ================================================================= """
""" =========================== Tab class =========================== """
""" ================================================================= """


class Tab(Driver):
    def __init__(self, client_id, tab_id=None, new_tab=None):
        self.client_id = client_id
        self.new_tab = new_tab
        if tab_id is not None:
            self.tab_id = tab_id
        else:
            self.tab_id = self.create_tab(new_tab=new_tab)
        self.remote_tab()

    def remote_tab(self,):
        """ Register a tab to remote tabs """
        response = self.command({
            'method': 'remote_tab',
            'params': {
                'tab_id': self.tab_id,
                'new_tab': self.new_tab,
            },
        })
        return response['data']

    def close_tab(self,):
        """ Register a tab to remote tabs """
        response = self.command({
            'method': 'close_tab',
            'params': {
                'tab_id': self.tab_id,
            },
        })
        return response['data']

    def __str__(self):
        return '<Uranium tab ~ id: '+str(self.tab_id)+'>'


""" ================================================================= """
""" =========================== Main class ========================== """
""" ================================================================= """


class sioUraniumRemote(socketio.ClientNamespace):
    async def on_connect(self):
        self.emit('driver_register', {'client_id': None})


class Uranium(Driver):
    """ Controls a browser by sending commands to a remote server. """

    def __init__(self, options):
        self.switch_to = SwitchTo(self.command)
        self.options = options
        self.prepare_config_extension()
        self.sio = socketio.Client()
        self.sio.connect('http://127.0.0.1:'+str(SERVER_PORT))
        self.sio.register_namespace(sioUraniumRemote('/'))

        self.launch()
        status = self.wait_client()
        self.remove_config_extension()
        if status == False:
            self.status = False
            raise Exception('Maybe user data directory is already in use. Please close browser and try again.')
        else:
            self.status = True
        self.tab_id = None

    def remote_tab(self, tab_id=None, new_tab=None):
        return Tab(self.client_id, tab_id=tab_id, new_tab=new_tab)

    def prepare_config_extension(self):
        # Prepare client_id
        self.tempdir = join(curdir, 'temp_configs')
        os.makedirs(self.tempdir, exist_ok=True)
        self.client_id = 'uranium_'+uuid.uuid4().hex
        self.uranium_extension = join(curdir, 'uranium_client')
        self.config_extension = join(self.tempdir, self.client_id)
        os.makedirs(self.config_extension, exist_ok=True)
        config_data = {"client_id": self.client_id, "server_port": SERVER_PORT}
        if self.options.proxy is not None:
            config_data['proxy'] = self.options.proxy.replace('http://', '')
        else:
            config_data['proxy'] = None
        config = {"name": "Uranium config", "description": json.dumps(config_data), "short_name": "uranium_config", "manifest_version": 2, "version": "1.0.0"}
        with open(join(self.config_extension, 'manifest.json'), "w") as outfile:
            json.dump(config, outfile)

    def remove_config_extension(self):
        try:
            shutil.rmtree(self.config_extension)
            return True
        except Exception as e:
            return False

    def update_driver_on_server(self, profile_dir=None):
        self.sio.emit('driver_register', {
            'client_id': self.client_id,
            'profile_dir': profile_dir
        })

    def launch(self):
        # sio.emit('driver_register', {'client_id': self.client_id})
        self.update_driver_on_server()
        if self.options.execute_path == None:
            if self.options.binary_auto == True:
                chrome64_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
                chrome32_path = r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
                if os.path.isfile(chrome64_path):
                    self.execute_path = chrome64_path
                elif os.path.isfile(chrome32_path):
                    self.execute_path = chrome32_path
                else:
                    return False
            else:
                return False
        else:
            self.execute_path = self.options.execute_path

        self.execute_command = '"'+self.execute_path + '" --disable-features=ChromeWhatsNewUI --disable-background-networking --disable-backgrounding-occluded-windows --disable-default-apps --disable-popup-blocking --disable-sync --disable-prompt-on-repost --cancel-first-run --lang=en-US --password-store=basic '
        if self.options.profile_path is not None:
            # print(self.options.profile_path)
            self.execute_command += '--user-data-dir="'+(r''+self.options.profile_path)+'" '
        else:
            print('Profile path is required!')
            return False
        if self.options.proxy is not None:
            self.execute_command += '--proxy-server="'+(r''+self.options.proxy)+'" '

        if self.options.images == False:
            self.execute_command += '--blink-settings=imagesEnabled=false '

        if self.options.audio == False:
            self.execute_command += '--mute-audio '

        exts = '--load-extension='+self.uranium_extension+','+self.config_extension+','
        if type(self.options.extensions) == list and len(self.options.extensions) > 0:
            for ext in self.options.extensions:
                exts += ext+','
        self.execute_command += (exts)+' '

        if type(self.options.chrome_args) == list and len(self.options.chrome_args) > 0:
            for arg in self.options.chrome_args:
                self.execute_command += (arg)+' '
        client = os.popen(self.execute_command)

    def __exit__(self, *args):
        self.quit()

    def __str__(self):
        return '<Uranium object - status: '+str(self.status)+'>'

