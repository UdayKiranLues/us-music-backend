# US Music Backend Makefile
# Supports Docker and non-Docker deployment on GCP

.PHONY: help install build start stop restart logs clean dev test deploy setup-gcp

# Default target
help:
	@echo "US Music Backend - Available Commands:"
	@echo ""
	@echo "  make install          - Install Node.js dependencies"
	@echo "  make setup-env        - Create .env file from example"
	@echo "  make build            - Build Docker image"
	@echo "  make start            - Start the application (Docker or Node)"
	@echo "  make start-docker     - Start with Docker Compose"
	@echo "  make start-node       - Start with Node.js directly"
	@echo "  make start-pm2        - Start with PM2 process manager"
	@echo "  make stop             - Stop the application"
	@echo "  make restart          - Restart the application"
	@echo "  make logs             - View application logs"
	@echo "  make clean            - Clean build artifacts and logs"
	@echo "  make dev              - Start in development mode"
	@echo "  make test             - Run tests"
	@echo "  make deploy           - Deploy to production (GCP)"
	@echo "  make setup-gcp        - Initial setup on GCP instance"
	@echo ""

# Install dependencies
install:
	@echo "Installing Node.js dependencies..."
	npm install
	@echo "Dependencies installed successfully!"

# Setup environment file
setup-env:
	@if [ ! -f .env ]; then \
		echo "Creating .env file from .env.example..."; \
		cp .env.example .env; \
		echo ".env file created. Please edit it with your actual values."; \
	else \
		echo ".env file already exists."; \
	fi

# Build Docker image
build:
	@echo "Building Docker image..."
	@if command -v docker-compose >/dev/null 2>&1; then \
		docker-compose build; \
	elif command -v docker >/dev/null 2>&1 && command -v compose >/dev/null 2>&1; then \
		docker compose build; \
	else \
		echo "Docker Compose not found. Skipping Docker build."; \
	fi

# Start application (auto-detect method)
start:
	@if command -v docker-compose >/dev/null 2>&1 || (command -v docker >/dev/null 2>&1 && command -v compose >/dev/null 2>&1); then \
		$(MAKE) start-docker; \
	elif command -v pm2 >/dev/null 2>&1; then \
		$(MAKE) start-pm2; \
	else \
		$(MAKE) start-node; \
	fi

# Start with Docker Compose
start-docker:
	@echo "Starting with Docker Compose..."
	@if command -v docker-compose >/dev/null 2>&1; then \
		docker-compose up -d; \
		echo "Application started with Docker Compose!"; \
		echo "View logs: make logs"; \
	elif command -v docker >/dev/null 2>&1 && command -v compose >/dev/null 2>&1; then \
		docker compose up -d; \
		echo "Application started with Docker Compose!"; \
		echo "View logs: make logs"; \
	else \
		echo "Error: Docker Compose not found. Install Docker Compose or use 'make start-node'"; \
		exit 1; \
	fi

# Start with Node.js directly
start-node:
	@echo "Starting with Node.js..."
	@if [ ! -f .env ]; then \
		echo "Error: .env file not found. Run 'make setup-env' first."; \
		exit 1; \
	fi
	@if [ ! -d node_modules ]; then \
		echo "Dependencies not installed. Running 'make install'..."; \
		$(MAKE) install; \
	fi
	@echo "Starting backend server..."
	nohup node src/server.js > logs/app.log 2>&1 &
	@echo $$! > .pid
	@echo "Application started! PID: $$(cat .pid)"
	@echo "View logs: tail -f logs/app.log"

# Start with PM2
start-pm2:
	@echo "Starting with PM2..."
	@if ! command -v pm2 >/dev/null 2>&1; then \
		echo "PM2 not found. Installing PM2..."; \
		npm install -g pm2; \
	fi
	@if [ ! -f .env ]; then \
		echo "Error: .env file not found. Run 'make setup-env' first."; \
		exit 1; \
	fi
	@if [ ! -d node_modules ]; then \
		echo "Dependencies not installed. Running 'make install'..."; \
		$(MAKE) install; \
	fi
	pm2 start src/server.js --name us-music-backend --env production
	pm2 save
	@echo "Application started with PM2!"
	@echo "View logs: pm2 logs us-music-backend"
	@echo "Monitor: pm2 monit"

# Stop application
stop:
	@echo "Stopping application..."
	@if command -v docker-compose >/dev/null 2>&1; then \
		docker-compose down; \
	elif command -v docker >/dev/null 2>&1 && command -v compose >/dev/null 2>&1; then \
		docker compose down; \
	elif command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q us-music-backend; then \
		pm2 stop us-music-backend; \
		pm2 delete us-music-backend; \
	elif [ -f .pid ]; then \
		kill $$(cat .pid) 2>/dev/null || true; \
		rm -f .pid; \
	fi
	@echo "Application stopped!"

# Restart application
restart: stop start

# View logs
logs:
	@if command -v docker-compose >/dev/null 2>&1; then \
		docker-compose logs -f; \
	elif command -v docker >/dev/null 2>&1 && command -v compose >/dev/null 2>&1; then \
		docker compose logs -f; \
	elif command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q us-music-backend; then \
		pm2 logs us-music-backend; \
	elif [ -f logs/app.log ]; then \
		tail -f logs/app.log; \
	else \
		echo "No logs found. Application may not be running."; \
	fi

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts and logs..."
	rm -rf node_modules
	rm -rf logs/*.log
	rm -f .pid
	@if command -v docker-compose >/dev/null 2>&1; then \
		docker-compose down -v; \
	elif command -v docker >/dev/null 2>&1 && command -v compose >/dev/null 2>&1; then \
		docker compose down -v; \
	fi
	@echo "Clean complete!"

# Development mode
dev:
	@echo "Starting in development mode..."
	@if [ ! -f .env ]; then \
		$(MAKE) setup-env; \
	fi
	@if [ ! -d node_modules ]; then \
		$(MAKE) install; \
	fi
	npm run dev

# Run tests
test:
	@echo "Running tests..."
	npm test

# Deploy to production (GCP)
deploy:
	@echo "Deploying to GCP production..."
	@echo "1. Pulling latest code from GitHub..."
	git pull origin main
	@echo "2. Installing/updating dependencies..."
	npm install --production
	@echo "3. Restarting application..."
	$(MAKE) restart
	@echo "Deployment complete!"

# Initial GCP setup
setup-gcp:
	@echo "Setting up backend on GCP instance..."
	@echo ""
	@echo "Step 1: Checking Node.js..."
	@if ! command -v node >/dev/null 2>&1; then \
		echo "Node.js not found. Installing Node.js 18.x..."; \
		curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -; \
		sudo apt-get install -y nodejs; \
	else \
		echo "Node.js found: $$(node --version)"; \
	fi
	@echo ""
	@echo "Step 2: Installing PM2 globally..."
	sudo npm install -g pm2
	@echo ""
	@echo "Step 3: Creating logs directory..."
	mkdir -p logs
	@echo ""
	@echo "Step 4: Setting up environment..."
	$(MAKE) setup-env
	@echo ""
	@echo "Step 5: Installing dependencies..."
	$(MAKE) install
	@echo ""
	@echo "Setup complete! Next steps:"
	@echo "1. Edit .env file with your configuration: nano .env"
	@echo "2. Start the application: make start-pm2"
	@echo "3. Setup PM2 startup script: sudo pm2 startup"
	@echo "4. Save PM2 configuration: pm2 save"

# Status check
status:
	@echo "Checking application status..."
	@if command -v pm2 >/dev/null 2>&1; then \
		pm2 list; \
	elif command -v docker-compose >/dev/null 2>&1; then \
		docker-compose ps; \
	elif command -v docker >/dev/null 2>&1 && command -v compose >/dev/null 2>&1; then \
		docker compose ps; \
	elif [ -f .pid ] && ps -p $$(cat .pid) > /dev/null 2>&1; then \
		echo "Application is running (PID: $$(cat .pid))"; \
	else \
		echo "Application is not running"; \
	fi

# Update application from GitHub
update:
	@echo "Updating from GitHub..."
	git pull origin main
	@echo "Update complete! Run 'make restart' to apply changes."
