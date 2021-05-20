FROM saucelabs/testrunner-image:v0.2.0

WORKDIR /home/seluser

USER seluser

ENV NODE_VERSION=12.16.2
ENV NVM_VERSION=0.35.3
ENV IMAGE_NAME=saucelabs/stt-cypress-mocha-node

ARG BUILD_TAG
ARG CYPRESS_VERSION
ENV CYPRESS_VERSION=${CYPRESS_VERSION}
ENV IMAGE_TAG=${BUILD_TAG}

RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh | bash \
  && export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")" \
  && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" \
  && nvm install ${NODE_VERSION}

ENV PATH="/home/seluser/bin:/home/seluser/.nvm/versions/node/v${NODE_VERSION}/bin:${PATH}"

COPY package.json .
COPY package-lock.json .
RUN npm ci --production

RUN mkdir -p ~/__project__

COPY --chown=seluser:seluser . .
# Cypress caches its binary by default in ~/.cache/Cypress
# However, running the container in CI may result in a different active user and therefore home folder.
# That's why we let Cypress know where the location actually is.
ENV CYPRESS_CACHE_FOLDER=/home/seluser/.cache/Cypress

# Let saucectl know where to mount files
RUN mkdir -p /home/seluser/__project__/ && chown seluser:seluser /home/seluser/__project__/
LABEL com.saucelabs.project-dir=/home/seluser/__project__/
ENV SAUCE_PROJECT_DIR=/home/seluser/__project__/

# Let saucectl know what command to execute
LABEL com.saucelabs.entrypoint=/home/seluser/bin/cypress

LABEL com.saucelabs.job-info=/tmp/output.json
RUN echo "{}" > /tmp/output.json

CMD ["./entry.sh"]
