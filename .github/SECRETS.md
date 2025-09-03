# GitHub Repository Secrets Configuration

This document outlines the required secrets for the CI/CD pipeline to function properly.

## Required Secrets

### API Keys
- `OPENAI_API_KEY` - OpenAI API key for LLM functionality
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude models

### Container Registry
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- `DOCKER_USERNAME` - Docker Hub username (if using Docker Hub)
- `DOCKER_PASSWORD` - Docker Hub password (if using Docker Hub)

### Deployment
- `SLACK_WEBHOOK` - Slack webhook URL for deployment notifications
- `GRAFANA_ADMIN_PASSWORD` - Grafana admin password for production

### Environment Variables
- `NODE_ENV` - Environment (development/staging/production)
- `CHROMADB_HOST` - ChromaDB host
- `CHROMADB_PORT` - ChromaDB port
- `CHROMADB_PATH` - ChromaDB connection path

## How to Add Secrets

1. Go to your GitHub repository
2. Click on "Settings" tab
3. Click on "Secrets and variables" in the left sidebar
4. Click on "Actions"
5. Click "New repository secret"
6. Add each secret with the exact name and value

## Environment-Specific Secrets

### Staging Environment
- `STAGING_OPENAI_API_KEY`
- `STAGING_ANTHROPIC_API_KEY`
- `STAGING_DATABASE_URL`

### Production Environment
- `PRODUCTION_OPENAI_API_KEY`
- `PRODUCTION_ANTHROPIC_API_KEY`
- `PRODUCTION_DATABASE_URL`
- `PRODUCTION_GRAFANA_ADMIN_PASSWORD`

## Security Best Practices

1. **Never commit secrets to code**
2. **Use environment-specific secrets**
3. **Rotate secrets regularly**
4. **Use least privilege principle**
5. **Monitor secret usage**
6. **Use secret scanning tools**

## Testing Secrets

You can test if secrets are properly configured by running:

```bash
# Test in GitHub Actions
echo "Testing secret: ${{ secrets.OPENAI_API_KEY }}"

# Test locally (for development)
echo $OPENAI_API_KEY
```

## Troubleshooting

### Common Issues

1. **Secret not found**: Check the exact name matches
2. **Permission denied**: Ensure the secret is accessible to the workflow
3. **Environment mismatch**: Verify the secret is in the correct environment

### Debug Commands

```bash
# List all secrets (without values)
gh secret list

# Get secret value (requires gh CLI)
gh secret get OPENAI_API_KEY
```
