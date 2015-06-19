## About

A fork of https://addons.mozilla.org/en-US/android/addon/fennec-screenshot/.

Adds menu items to take screenshots of the active tab. Perhaps more usefully, this addon has the ability to play URLs from `content/sites.txt` and take screenshots from when they are completely loaded.

It attempts to use the DPI of the device, but will scale down in the case of an exception (likely the surface is gigantic).

### Usage

1) `mv content/sites.txt.example content/sites.txt
2) Add the sites you want to test
3) `./build` (after setting correct target)
4) From the Fennec menu, select Screenshot > Capture from sites.txt

The captured image will be saved as PNG format in your Downloads folder.  
If you need to save it as JPEG, please turn on the use_jpeg option.  

If you need to save the image into a specific folder as you wish,  

1. Open "about:config"
2. Edit the following prefs

 * "browser.download.folderList" => 2
 * "browser.download.dir" => "/mnt/sdcard/WebScreenshots"


### License
MPL/GPL/LGPL triple license  
See the `LICENSE.txt`.

Originally authored by TakaChan.  
Modified by Mike Taylor.
