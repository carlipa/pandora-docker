import 'source-map-support/register';

import { promisifyAll } from 'bluebird';
import Docker from 'dockerode';
import * as url from 'url';
import * as path from 'path';
import * as fs from 'fs';
import { each } from 'lodash';

export default class PandoraDocker {
  _docker = null;
  _socketPath = null;

  /**
   * Pandora Docker Constructor
   * @param dockerSocket
   * @param dockerHost
   * @param dockerCertPath
   */
  constructor ({ dockerSocket, dockerHost, dockerCertPath } = {}) {
    const socket = dockerSocket || process.env.DOCKER_SOCKET || '/var/run/docker.sock';

    try {
      if (fs.statSync(socket).isSocket()) {
        this._docker = promisifyAll(new Docker({ socketPath: socket }));
        // If the connection using the socket is successful, keep its path
        this._socketPath = socket;
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        // There is no socket file, continues
      } else {
        throw err;
      }
    }

    // If no socket, use docker http client
    if (!this._docker) {
      let dockerHostUrl;

      try {
        dockerHostUrl = url.parse(dockerHost || process.env.DOCKER_HOST);
      } catch (err) {
        // `url#parse` will only throw if neither `dockerHost` nor `process.env.DOCKER_HOST` are defined
        throw new Error('Fatal error: No docker socket available, ' +
          'and no DOCKER_HOST provided, cannot create a dockerode instance');
      }

      this._docker = promisifyAll(new Docker({
        host: dockerHostUrl.hostname,
        port: dockerHostUrl.port,
        ca: fs.readFileSync(path.join(dockerCertPath || process.env.DOCKER_CERT_PATH, 'ca.pem')),
        cert: fs.readFileSync(path.join(dockerCertPath || process.env.DOCKER_CERT_PATH, 'cert.pem')),
        key: fs.readFileSync(path.join(dockerCertPath || process.env.DOCKER_CERT_PATH, 'key.pem'))
      }));
    }
  }

  getDocker () {
    return this._docker;
  }

  getSocketPath () {
    return this._socketPath;
  }

  /**
   * Using the container data, returns a formatted list of exposed ports
   * @param containerData the container data
   * @returns {Array} the ports list
   */
  static getHostPorts (containerData) {
    const portsDatas = containerData.NetworkSettings.Ports;

    const hostPorts = [];

    each(portsDatas, (portsData, containerPort) => {
      if (portsData) {
        each(portsData, (portData) => {
          if (portData.HostPort) {
            hostPorts.push({
              containerPort: containerPort.split('/')[0],
              protocol: containerPort.split('/')[1],
              hostPort: portData.HostPort
            });
          }
        });
      }
    });

    return hostPorts;
  }
}
