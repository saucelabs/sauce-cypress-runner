DOCKER_IMAGE_NAME := saucelabs/stt-cypress-mocha-node

docker:
	docker build -t $(DOCKER_IMAGE_NAME):latest .