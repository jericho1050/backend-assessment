#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="mycure-backend-assessment"
REGISTRY="ghcr.io/jericho1050"
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "latest")
PLATFORMS="linux/amd64,linux/arm64"

# Parse arguments
ENV=${1:-development}
PUSH=${2:-false}

echo -e "${GREEN}Building Docker image for ${ENV} environment${NC}"
echo "Version: ${VERSION}"

# Build based on environment
case $ENV in
  development)
    echo -e "${YELLOW}Building development image...${NC}"
    docker build \
      -f Dockerfile.dev \
      -t ${IMAGE_NAME}:dev \
      --target development \
      .
    ;;
    
  production)
    echo -e "${YELLOW}Building production image...${NC}"
    docker buildx build \
      -f Dockerfile \
      -t ${IMAGE_NAME}:${VERSION} \
      -t ${IMAGE_NAME}:latest \
      --target production \
      --platform ${PLATFORMS} \
      $([ "$PUSH" = "true" ] && echo "--push") \
      .
    ;;
    
  test)
    echo -e "${YELLOW}Building test image...${NC}"
    docker build \
      -f Dockerfile.dev \
      -t ${IMAGE_NAME}:test \
      --target development \
      .
    ;;
    
  *)
    echo -e "${RED}Unknown environment: ${ENV}${NC}"
    echo "Usage: $0 [development|production|test] [push]"
    exit 1
    ;;
esac

echo -e "${GREEN}Build complete!${NC}"

# Tag for registry if production
if [ "$ENV" = "production" ] && [ "$PUSH" = "true" ]; then
  echo -e "${YELLOW}Pushing to registry...${NC}"
  docker tag ${IMAGE_NAME}:${VERSION} ${REGISTRY}/${IMAGE_NAME}:${VERSION}
  docker tag ${IMAGE_NAME}:latest ${REGISTRY}/${IMAGE_NAME}:latest
  docker push ${REGISTRY}/${IMAGE_NAME}:${VERSION}
  docker push ${REGISTRY}/${IMAGE_NAME}:latest
  echo -e "${GREEN}Push complete!${NC}"
fi