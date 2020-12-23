FROM saucelabs/testrunner-image:v0.1.0

WORKDIR /home/seluser

USER seluser

ENV NODE_VERSION=12.16.2
ENV NVM_VERSION=0.35.3
ENV CYPRESS_VERSION=5.6.0
RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh | bash \
  && export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")" \
  && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" \
  && nvm install ${NODE_VERSION}

ENV PATH="/home/seluser/bin:/home/seluser/.nvm/versions/node/v${NODE_VERSION}/bin:${PATH}"

COPY package.json .
COPY package-lock.json .
RUN npm ci

COPY --chown=seluser:seluser . .
# Cypress caches its binary by default in ~/.cache/Cypress
# However, running the container in CI may result in a different active user and therefore home folder.
# That's why we let Cypress know where the location actually is.
ENV CYPRESS_CACHE_FOLDER=/home/seluser/.cache/Cypress

# Let saucectl know where to mount files
LABEL com.saucelabs.project-dir=/home/seluser/

# Workaround for permissions in CI if run with a different user
RUN chmod 777 -R /home/seluser/

CMD ["./entry.sh"]
