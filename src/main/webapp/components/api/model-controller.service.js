'use strict';

angular.module('managementConsole.api')
    .factory('modelController', [
    '$http',
    '$q',
    'DomainModel',
    'utils',
    function ($http, $q, DomainModel, utils) {
            /**
             * Represents a client to the ModelController
             * @constructor
             * @param {string} url - the URL to the ModelController management endpoint
             */
            var ModelControllerClient = function (url) {
                this.uploadUrl = url + '/management-upload';
                this.url = url + '/management';
                this.authenticated = false;
                this.credentials = {
                    username: null,
                    password: null
                };
                this.server = null;
            };

            ModelControllerClient.prototype.isAuthenticated = function() {
                return this.authenticated;
            };

            ModelControllerClient.prototype.getServer = function() {
                return this.server;
            };

            ModelControllerClient.prototype.serverInfo = function() {
                return this.execute();
            };

            /**
             * Logs into the management endpoint and determines the launch type
             * @param {string} username - the username to use when connecting to the management endpoint
             * @param {string} password - the password to use when connecting to the management endpoint
             */
            ModelControllerClient.prototype.login = function (username, password) {
                this.credentials.username = username;
                this.credentials.password = password;
                return this.readResource([], false, true).then(function (response) {
                    this.authenticated = true;
                    var launchType = response['launch-type'];
                    if (launchType === 'DOMAIN') {
                        this.server = new DomainModel(this, response);
                    } else if (launchType === 'STANDALONE') {
                        //TODO
                    }
                }.bind(this)).catch(function(e){
                  throw e;
                });
            };

            ModelControllerClient.prototype.refresh = function() {
                return this.server.refresh();
            };

            ModelControllerClient.prototype.logout = function() {
                this.credentials = {
                    username: null,
                    password: null
                };
                this.authenticated = false;
                this.server = null;
            };

            ModelControllerClient.prototype.getUser = function() {
                if (this.authenticated) {
                    return this.credentials.username;
                } else {
                    return null;
                }
            };

            /**
             * Executes an operation
             * @param data
             * @param callback
             */
            ModelControllerClient.prototype.execute = function (op, url) {
                var url = (typeof url === 'undefined') ? this.url : url;
                var deferred = $q.defer();
                var http = new XMLHttpRequest();
                if (this.credentials.username) {
                  http.withCredentials = true;
                  http.open('POST', url, true, this.credentials.username, this.credentials.password);
                } else {
                  http.open('POST', url, true);
                }

                http.setRequestHeader('Content-type', 'application/json');
                http.setRequestHeader('Accept', 'application/json');
                http.onreadystatechange = function () {
                  if (http.readyState === 4 && http.status === 200) {
                    var response = JSON.parse(http.responseText);
                    if (response.outcome === 'success') {
                      deferred.resolve(response.result);
                    } else {
                      deferred.reject();
                    }
                  }
                  else if (http.status >= 400 && http.status <= 505){
                    deferred.reject(http.statusText);
                  }
                };
                http.send(JSON.stringify(op));
                return deferred.promise;
            };

            ModelControllerClient.prototype.executeDeploymentOp = function(op, file, uploadProgress) {
              var deferred = $q.defer();
              var fd = new FormData();

              //First we append the file if we have it
              if (utils.isNotNullOrUndefined(file)) {
                fd.append('file', file);
              }

              //Second, we append the DMR operation
              var blob = new Blob([JSON.stringify(op)], {type : "application/json"});
              fd.append('operation', blob);

              var http = new XMLHttpRequest();

              http.upload.addEventListener("progress", uploadProgress, false);

              http.addEventListener("readystatechange", function (e) {
                // upload completed
                if (this.readyState === 4) {
                  console.log('Success: Upload done', e);

                  var response = e.target.response;

                  if (response) {
                    try {
                      console.log("Got response" + response);
                      response = JSON.parse(response);
                    } catch (e) {
                      console.log('JSON.parse()', e);
                    }
                  }

                  //callback(false, response);
                }
              });

              http.addEventListener("error", function (e) {
                console.log('Error: Upload failed', e);
                //callback(true);
              });

              //Third, we open http connection
              if (this.credentials.username) {
                http.withCredentials = true;
                http.open('POST', this.uploadUrl, true, this.credentials.username, this.credentials.password);
              } else {
                http.open('POST', this.uploadUrl, true);
              }


              //special headers to prevent CSRF
              http.setRequestHeader('X-Management-Client-Name', 'HAL');

              //Finally, send the form data to the server
              http.send(fd);
              return deferred.promise;
            };

            ModelControllerClient.prototype.readAttribute = function (address, name) {
                var op = {
                    'operation': 'read-attribute',
                    'name': name,
                    'address': address
                };
                return this.execute(op);
            };

            ModelControllerClient.prototype.writeAttribute = function (address, name, value) {
              var op = {
                'operation': 'write-attribute',
                'name': name,
                'value':value,
                'address': address
              };
              return this.execute(op);
            };

            ModelControllerClient.prototype.readAttributeAndResolveExpressions = function (address, name, resolveExpressions) {
              var op = {
                'operation': 'read-attribute',
                'name': name,
                'address': address,
                'resolve-expressions': resolveExpressions
              };
              return this.execute(op);
            };

            ModelControllerClient.prototype.readChildrenNames = function (address, type) {
                var op = {
                    'operation': 'read-children-names',
                    'child-type': type,
                    'address': address
                };
                return this.execute(op);
            };

            ModelControllerClient.prototype.readChildrenResources = function (address, type, recursiveDepth, proxies, includeRuntime) {
                var op = {
                    'operation': 'read-children-resources',
                    'child-type': type,
                    'recursive': recursiveDepth > 1,
                    'recursive-depth': recursiveDepth,
                    'proxies': proxies,
                    'include-runtime': includeRuntime,
                    'address': address
                };
                return this.execute(op);
            };


            ModelControllerClient.prototype.readResource = function (address, recursive, includeRuntime) {
                var op = {
                    'operation': 'read-resource',
                    'recursive': recursive,
                    'include-runtime': includeRuntime,
                    'address': address
                };
                return this.execute(op);
            };

            ModelControllerClient.prototype.readResourceDescription = function (address, recursive, includeRuntime) {
                var op = {
                    'operation': 'read-resource-description',
                    'recursive': recursive,
                    'include-runtime': includeRuntime,
                    'address': address
                };
                return this.execute(op);
            };

            ModelControllerClient.prototype.createAddArtifactOp = function (deploymentArtifact) {
              var op = {
                operation: "add",
                address: [{
                  deployment: deploymentArtifact
                }],
                'runtime-name': deploymentArtifact,
                enabled: "false",
                content: [{'input-stream-index': 0}]
              };
              return op;
            };

            ModelControllerClient.prototype.deployArtifact = function (serverGroup, deployment) {
              var op = {
                operation: 'deploy',
                address: [{
                  deployment: deployment
                }]
              };
              return this.executeDeploymentOp(op);
            };

            ModelControllerClient.prototype.undeployArtifact = function (serverGroup, deployment) {
              var op = {
                operation: 'undeploy',
                address: [{
                  deployment: deployment
                }]
              };
              return this.executeDeploymentOp(op, this.uploadUrl);
            };

            ModelControllerClient.prototype.removeArtifact = function (serverGroup, deployment) {
              var op = {
                operation: 'remove',
                address: [{
                  deployment: deployment
                }]
              };
              return this.execute(op);
            };

            ModelControllerClient.prototype.getDeployedArtifacts = function (serverGroup) {
              return this.readChildrenResources([],'deployment');
            };

            return new ModelControllerClient(window.location.origin);
    }
  ]);
