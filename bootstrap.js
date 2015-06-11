/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the "Fennec Screenshot".
 *
 * The Initial Developer of the Original Code is TakaChan.
 * Portions created by the Initial Developer are Copyright (C) 2012
 * the Initial Developer. All Rights Reserved.
 *
 * Hacked on by Mike Taylor to do other cool things. Also to actually work.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");

// Set to true or false if you want logging.
let DEBUG = true;

//===========================================
// FennecScreenshot
//===========================================
let FennecScreenshot = {
  _branch: null,
  _menuIds: {},

  setupDefaultPrefs: function() {
    let branch = Services.prefs.getDefaultBranch('extensions.fennecscreenshot.');
    branch.setBoolPref('capture_visible.enabled', true);
    branch.setBoolPref('capture_entire.enabled', true);
    branch.setBoolPref('use_jpeg', false);
  },

  init: function() {
    this.setupDefaultPrefs();

    if (!this._branch) {
        this._branch = Services.prefs.getBranch('extensions.fennecscreenshot.');
        this._branch.addObserver('', this, false);
    }
  },

  uninit: function() {
    if (this._branch) {
        this._branch.removeObserver('', this);
        this._branch = null;
    }
  },

  load: function(aWindow) {
    if (!aWindow)
        return;

    // Create UI
    this.setupUI(aWindow);
  },

  unload: function(aWindow) {
    if (!aWindow)
        return;

    // Clean up the UI
    this.cleanupUI(aWindow);
  },

  setupUI: function(aWindow) {
    let self = this;
    let menu = aWindow.NativeWindow.menu;

    let visible_enabled = this._branch.getBoolPref('capture_visible.enabled');
    let entire_enabled = this._branch.getBoolPref('capture_entire.enabled');

    if (visible_enabled || entire_enabled) {
      this._menuIds['ScreenshotMenu'] = menu.add({
          name: tr('ScreenshotMenu'),
          icon: null
      });

      if (visible_enabled) {
        this._menuIds['CaptureVisible'] = menu.add({
          name: tr('CaptureVisible'),
          parent: this._menuIds['ScreenshotMenu'],
          callback: function() {
            let format = (self._branch && self._branch.getBoolPref('use_jpeg'))
                          ? 'image/jpeg'
                          : 'image/png';

            let captureData = self._capture(aWindow, 'visible', format);
            if (captureData) {
              self._saveImage(aWindow, captureData);
            }
          }
        });
      }

      if (entire_enabled) {
        this._menuIds['CaptureEntire'] = menu.add({
          name: tr('CaptureEntire'),
          parent: this._menuIds['ScreenshotMenu'],
          callback: function() {
            let format = (self._branch && self._branch.getBoolPref('use_jpeg'))
                                ? 'image/jpeg'
                                : 'image/png';

            let captureData = self._capture(aWindow, 'entire', format);
            if (captureData)
                self._saveImage(aWindow, captureData);
          }
        });
      }
    }
  },

  cleanupUI: function(aWindow) {
    for (let k in this._menuIds) {
      let id = this._menuIds[k];
      aWindow.NativeWindow.menu.remove(id);
    }

    this._menuIds = {};
  },

  observe: function(aSubject, aTopic, aData) {
    switch (aData) {
      case 'capture_entire.enabled':
      case 'capture_visible.enabled':
        let windows = Services.wm.getEnumerator('navigator:browser');
        while (windows.hasMoreElements()) {
          let win = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
          if (win) {
            this.cleanupUI(win);
            this.setupUI(win);
          }
        }
        break;
    }
  },

  _capture: function(aWindow, aCaptureArea, aFormat) {
    let selectedTab = aWindow.BrowserApp.selectedTab;
    let window = selectedTab.window;
    let document = window.document;

    if (!document.body) {
        showToast(aWindow, tr('CouldNotCapture'));
        return null;
    }

    let x, y, w, h;
    switch (aCaptureArea) {
      case 'entire':
        let html = document.documentElement;
        x = y = 0;
        w = html.scrollWidth;
        h = html.scrollHeight;
        break;

      case 'visible':
        let viewport = selectedTab.getViewport();
        x = viewport.cssX; // == html.scrollLeft;
        y = viewport.cssY; // == html.scrollTop;
        w = Math.round(viewport.cssWidth);
        h = Math.round(viewport.cssHeight);
        break;

      default:
        log('Error: aCaptureArea is invalid');
        return null;
    }

    let ext;
    switch (aFormat) {
      case 'image/png':
        ext = 'png';
        break;
      case 'image/jpeg':
        ext = 'jpg';
        break;
      default:
        aFormat = 'image/png';
        ext = 'png';
    }

    let canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.style.display = 'none';

    document.body.appendChild(canvas);

    let context2d = canvas.getContext('2d');

    // TODO https://bugzilla.mozilla.org/show_bug.cgi?id=780362#c10
    // https://github.com/luser/asteroids/blob/master/asteroids.js#L42
    context2d.drawWindow(window, x, y, w, h, '#ffffff', 0x01 | 0x08);

    let captureData = {
      dataURL: canvas.toDataURL(aFormat),
      width: w,
      height: h,
      dataType: aFormat,
      extension: ext,
    };

    document.body.removeChild(canvas);

    return captureData;
  },

  _saveImage: function(aWindow, aCaptureData) {
    let selectedTab = aWindow.BrowserApp.selectedTab;
    let document = selectedTab.window.document;

    // Show progress in the Download Manager
    let dm = Services.downloads;

    // Saving into a specific directory, open 'about:config'
    // and edit the following prefs:
    // "browser.download.folderList" = 2
    // "browser.download.dir" = "/mnt/sdcard/WebScreenshots"
    let downloadDir = dm.userDownloadsDirectory;

    let mimeSrv = Cc['@mozilla.org/mime;1'].getService(Ci.nsIMIMEService);
    let mimeInfo = mimeSrv.getFromTypeAndExtension(aCaptureData.dataType,
                                                   aCaptureData.extension);

    let caUtils = aWindow.ContentAreaUtils;

    var fileName = caUtils.getDefaultFileName(
                                document.title,
                                selectedTab.browser.currentURI,
                                document,
                                null).trim();

    var fileName = caUtils.getNormalizedLeafName(fileName,
                                                 aCaptureData.extension);

    let file = downloadDir.clone();
    file.append(fileName);
    file.createUnique(file.NORMAL_FILE_TYPE, parseInt('666', 8));

    log('Download path: ' + file.path);

    let cancelable = { cancel: function(aReason) {}, };

    let isPrivate = false;
    let win = selectedTab.browser.contentWindow;

    if (PrivateBrowsingUtils.isContentWindowPrivate) {
      isPrivate = PrivateBrowsingUtils.isContentWindowPrivate(win);
    } else {
      isPrivate = PrivateBrowsingUtils.isWindowPrivate(win);
    }

    let sourceURI = Services.io.newURI(aCaptureData.dataURL, null, null);
    let destURI = Services.io.newFileURI(file);

    let download = dm.addDownload(Ci.nsIDownloadManager.DOWNLOAD_TYPE_DOWNLOAD,
                                 sourceURI,
                                 destURI,
                                 fileName,
                                 mimeInfo,
                                 Date.now() * 1000,
                                 null,
                                 cancelable,
                                 isPrivate);

    // Make WebBrowserPersist
    const nsIWBP = Ci.nsIWebBrowserPersist;
    const wbp_flags = nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
    let wbp = Cc['@mozilla.org/embedding/browser/nsWebBrowserPersist;1']
                                .createInstance(Ci.nsIWebBrowserPersist);

    wbp.persistFlags = wbp_flags | nsIWBP.PERSIST_FLAGS_FROM_CACHE;
    wbp.progressListener = download;

    let privacyContext = selectedTab.window.QueryInterface(Ci.nsIInterfaceRequestor)
                                           .getInterface(Ci.nsIWebNavigation)
                                           .QueryInterface(Ci.nsILoadContext);

    wbp.saveURI(sourceURI, null, null, 0, null, null, destURI, privacyContext);
  }
};


//===========================================
// bootstrap.js API
//===========================================
function startup(aData, aReason) {
  // General setup
  FennecScreenshot.init();

  // Load into any existing windows
  let windows = Services.wm.getEnumerator('navigator:browser');
  while (windows.hasMoreElements()) {
    let win = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    if (win)
      FennecScreenshot.load(win);
  }

  // Load into any new windows
  Services.wm.addListener(windowListener);
}

function shutdown(aData, aReason) {
  // When the application is shutting down we normally don't have to clean
  // up any UI changes made
  if (aReason == APP_SHUTDOWN)
    return;

  // Stop listening for new windows
  Services.wm.removeListener(windowListener);

  // Unload from any existing windows
  let windows = Services.wm.getEnumerator('navigator:browser');
  while (windows.hasMoreElements()) {
    let win = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    if (win)
      FennecScreenshot.unload(win);
  }

  // General teardown
  FennecScreenshot.uninit();
}

function install(aData, aReason) {}
function uninstall(aData, aReason) {}

let windowListener = {
  onOpenWindow: function(aWindow) {
    let win = aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);

    win.addEventListener('UIReady', function() {
      win.removeEventListener('UIReady', arguments.callee, false);
      FennecScreenshot.load(win);
    }, false);
  },

  // Unused
  onCloseWindow: function(aWindow) {},
  onWindowTitleChange: function(aWindow, aTitle) {},
};


//===========================================
// Utilities
//===========================================
function log(aMsg) {
  if (!DEBUG)
    return;
  aMsg = 'FennecScreenshot: ' + aMsg;
  Services.console.logStringMessage(aMsg);
}

function showToast(aWindow, aMsg, aDuration) {
  if (aMsg) {
    aWindow.NativeWindow.toast.show(aMsg, aDuration || 'short');
  }
}

let gStringBundle = null;

function tr(aName) {
  // For translation
  if (!gStringBundle) {
    let uri = 'chrome://fennecscreenshot/locale/main.properties';
    gStringBundle = Services.strings.createBundle(uri);
  }

  try {
    return gStringBundle.GetStringFromName(aName);
  } catch (ex) {
    return aName;
  }
}

