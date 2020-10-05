FROM saucelabs/testrunner-image:v0.1.0

WORKDIR /home/seluser

USER seluser

ENV NODE_VERSION=12.16.2
ENV NVM_VERSION=0.35.3
RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh | bash \
  && export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")" \
  && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" \
  && nvm install ${NODE_VERSION}

ENV PATH="/home/seluser/bin:/home/seluser/.nvm/versions/node/v${NODE_VERSION}/bin:${PATH}"

ARG SAUCECTL_VERSION=0.14.0
ENV SAUCECTL_BINARY=saucectl_${SAUCECTL_VERSION}_linux_64-bit.tar.gz

RUN curl -L -o ${SAUCECTL_BINARY} \
  -H "Accept: application/octet-stream" \
  https://github.com/saucelabs/saucectl/releases/download/v${SAUCECTL_VERSION}/${SAUCECTL_BINARY} \
  && tar -xvzf ${SAUCECTL_BINARY} \
  && mkdir -p /home/seluser/bin/ \
  && mv ./saucectl /home/seluser/bin/saucectl \
  && rm ${SAUCECTL_BINARY}

COPY package.json .
COPY package-lock.json .
RUN npm i

COPY --chown=seluser:seluser . .
# Cypress caches its binary by default in ~/.cache/Cypress
# However, running the container in CI may result in a different active user and therefore home folder.
# That's why we let Cypress know where the location actually is.
ENV CYPRESS_CACHE_FOLDER=/home/seluser/.cache/Cypress

# Prepare cypress folders
RUN mkdir -p /home/seluser/cypress \
 && mkdir -p /home/seluser/cypress/integration/tests \
 && mkdir -p /home/seluser/cypress/fixtures \
 && mkdir -p /home/seluser/cypress/plugins \
 && mkdir -p /home/seluser/cypress/reporters \
 && mkdir -p /home/seluser/cypress/results \
 && mkdir -p /home/seluser/cypress/support

# Workaround for permissions in CI if run with a different user
RUN chmod 777 -R /home/seluser/

CMD ["./entry.sh"]
