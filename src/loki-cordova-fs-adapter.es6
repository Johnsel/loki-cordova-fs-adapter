class LokiCordovaFSAdapterError extends Error {}

const TAG = "[LokiCordovaFSAdapter]";
var lock = false;
var backOff = 1000;

class LokiCordovaFSAdapter {
    constructor(options) {
        this.options = options;
    }

    saveDatabase(dbname, dbstring, callback) {
        if (!lock) {
            var lock = true;
            console.log(TAG, "saving database");
            this._getFile(dbname,
              (fileEntry) => {
                  fileEntry.createWriter(
                    (fileWriter) => {
                        fileWriter.onwriteend = () => {
                            if (fileWriter.length === 0) {
                                fileWriter.seek(0);
                                var blob = this._createBlob(dbstring + '==}}}DBEND{{{', "text/plain");

                                fileWriter.onwriteend = () => {
                                    lock = false;
                                }
                                fileWriter.write(blob);
                                callback();
                            }
                        };
                        fileWriter.truncate(0);

                    },
                    (err) => {
                        console.error(TAG, "error writing file", err);
                        lock = false;
                        throw new LokiCordovaFSAdapterError("Unable to write file" + JSON.stringify(err));
                    }
                  );
              },
              (err) => {
                  console.error(TAG, "error getting file", err);
                  lock = false;
                  throw new LokiCordovaFSAdapterError("Unable to get file" + JSON.stringify(err));
              }
            );
        }
        else {
            backOff = backOff*2;
            console.warn(TAG, "sync locked, retrying in ", backOff);
            setTimeout(this.saveDatabase(dbname, dbstring, callback), backOff);

        }
    }

    loadDatabase(dbname, callback) {
        console.log(TAG, "loading database");
        this._getFile(dbname,
            (fileEntry) => {
                fileEntry.file((file) => {
                    var reader = new FileReader();
                    reader.onloadend = (event) => {
                        var contents = event.target.result;
                        if (contents.length === 0) {
                            console.warn(TAG, "couldn't find database");
                            callback(null);
                        } else {
                            var n = contents.indexOf('==}}}DBEND{{{');
                            if (n === -1) {
                                console.error(TAG, "error reading file", err);
                                callback(new LokiCordovaFSAdapterError("Unable to read file" + err.message));
                            } else {
                                var newContents = contents.substring(0, n - 1);
                                callback(newContents);
                            }
                        }
                    };
                    reader.readAsText(file);
                }, (err) => {
                    console.error(TAG, "error reading file", err);
                    callback(new LokiCordovaFSAdapterError("Unable to read file" + err.message));
                });
            },
            (err) => {
                console.error(TAG, "error getting file", err);
                callback(new LokiCordovaFSAdapterError("Unable to get file: " + err.message));
            }
        );
    }
    
    deleteDatabase(dbname, callback) {
        window.resolveLocalFileSystemURL(cordova.file.dataDirectory,
            (dir) => {
                let fileName = this.options.prefix + "__" + dbname;
                dir.getFile(fileName, {create: true}, 
                    (fileEntry) => {
                        fileEntry.remove(
                            () => {
                                callback();
                            },
                            (err) => {
                                console.error(TAG, "error delete file", err);
                                throw new LokiCordovaFSAdapterError("Unable delete file" + JSON.stringify(err));
                            }
                        );
                    },
                    (err) => {
                        console.error(TAG, "error delete database", err);
                        throw new LokiCordovaFSAdapterError(
                            "Unable delete database" + JSON.stringify(err)
                        );
                    }
                );
            },
            (err) => {
                throw new LokiCordovaFSAdapterError(
                    "Unable to resolve local file system URL" + JSON.stringify(err)
                );
            }
        );
    }

    _getFile(name, handleSuccess, handleError) {
        window.resolveLocalFileSystemURL(cordova.file.dataDirectory,
            (dir) => {
                let fileName = this.options.prefix + "__" + name;
                dir.getFile(fileName, {create: true}, handleSuccess, handleError);
            },
            (err) => {
                throw new LokiCordovaFSAdapterError(
                    "Unable to resolve local file system URL" + JSON.stringify(err)
                );
            }
        );
    }

    // adapted from http://stackoverflow.com/questions/15293694/blob-constructor-browser-compatibility
    _createBlob(data, datatype) {
        let blob;

        try {
            blob = new Blob([data], {type: datatype});
        }
        catch (err) {
            window.BlobBuilder = window.BlobBuilder ||
                    window.WebKitBlobBuilder ||
                    window.MozBlobBuilder ||
                    window.MSBlobBuilder;

            if (err.name === "TypeError" && window.BlobBuilder) {
                var bb = new window.BlobBuilder();
                bb.append(data);
                blob = bb.getBlob(datatype);
            }
            else if (err.name === "InvalidStateError") {
                // InvalidStateError (tested on FF13 WinXP)
                blob = new Blob([data], {type: datatype});
            }
            else {
                // We're screwed, blob constructor unsupported entirely
                throw new LokiCordovaFSAdapterError(
                    "Unable to create blob" + JSON.stringify(err)
                );
            }
        }
        return blob;
    }
}


export default LokiCordovaFSAdapter;
