# InfiniteContext Llamafile-Style Executable

This document explains how to build and use the InfiniteContext llamafile-style executable, which packages the entire system into a single, self-contained file that can be run on any compatible system without installation.

## What is a Llamafile-Style Executable?

Inspired by the [llamafile](https://github.com/Mozilla-Ocho/llamafile) project, our approach creates a single-file executable that contains:

1. The entire InfiniteContext codebase
2. All dependencies
3. A minimal runtime environment

This makes it extremely easy to distribute and run InfiniteContext on any compatible system without worrying about dependencies, installation, or configuration.

## Building the Executable

To build the InfiniteContext llamafile-style executable, run:

```bash
npm run build:llamafile
```

This will create a single executable file in the `dist` directory named `infinite-context`.

## Using the Executable

The executable provides a command-line interface for interacting with InfiniteContext. You can run it directly:

```bash
./dist/infinite-context
```

### Command-Line Interface

The executable provides the following commands:

#### Store Content

Store content in InfiniteContext:

```bash
./infinite-context store "This is some content to store" --bucket my-bucket --domain knowledge
```

Options:
- `-b, --bucket <name>`: Bucket name (default: "default")
- `-d, --domain <domain>`: Bucket domain (default: "general")
- `-t, --tags <tags>`: Comma-separated tags
- `--no-summarize`: Disable summarization
- `--tier <tier>`: Storage tier (0-4) (default: 1)

#### Retrieve Content

Retrieve content from InfiniteContext based on a query:

```bash
./infinite-context retrieve "What information do I have about AI?"
```

Options:
- `-b, --bucket <name>`: Bucket name (optional)
- `-d, --domain <domain>`: Bucket domain (optional)
- `-n, --max-results <number>`: Maximum number of results (default: 5)
- `-s, --min-score <number>`: Minimum similarity score (0-1) (default: 0.7)

#### Summarize Text

Summarize text:

```bash
./infinite-context summarize "This is a long text that I want to summarize..."
```

Options:
- `-l, --levels <number>`: Number of summary levels (default: 1)

#### Memory Statistics

Show memory usage statistics:

```bash
./infinite-context stats
```

#### Memory Alerts

Show memory alerts:

```bash
./infinite-context alerts
```

Options:
- `-a, --all`: Show all alerts, including acknowledged ones

#### Interactive Mode

Start interactive mode:

```bash
./infinite-context interactive
```

or

```bash
./infinite-context i
```

In interactive mode, you can enter commands directly:

```
> store This is some content to store
Content stored with ID: 12345

> retrieve What information do I have?
Found 2 results:
...

> summarize This is a long text that I want to summarize...
Generated summary:
...

> stats
Total chunks: 10
Total size: 0.50 MB

> alerts
2 alerts found.
[WARNING] Domain "knowledge" is growing rapidly

> help
Available commands:
  store <text>                - Store text in memory
  retrieve <query>            - Retrieve content based on query
  summarize <text>            - Summarize text
  stats                       - Show memory statistics
  alerts                      - Show memory alerts
  exit                        - Exit interactive mode

> exit
```

## Configuration

The executable looks for a `.env` file in the current directory for configuration. You can set the following environment variables:

```
# OpenAI API key for embeddings and summarization
OPENAI_API_KEY=your-api-key

# Base path for storing data (default: ~/.infinite-context)
INFINITE_CONTEXT_BASE_PATH=/path/to/data

# Embedding model to use (default: text-embedding-3-small)
INFINITE_CONTEXT_EMBEDDING_MODEL=text-embedding-3-small

# LLM model to use for summarization (default: gpt-3.5-turbo)
INFINITE_CONTEXT_LLM_MODEL=gpt-3.5-turbo
```

You can also pass these configuration options as command-line arguments:

```bash
./infinite-context --base-path /path/to/data --embedding-model text-embedding-3-small
```

## Cross-Platform Compatibility

The executable is designed to work on:

- Linux
- macOS
- Windows (with WSL)

## Technical Details

The executable is a self-extracting archive that:

1. Creates a temporary directory
2. Extracts the bundled application to the temporary directory
3. Runs the application with Node.js
4. Cleans up the temporary directory when done

This approach ensures that the executable is completely self-contained and doesn't leave any files behind after running.

## Limitations

- The executable requires Node.js to be installed on the system
- Some features may not work on all platforms
- The executable is larger than a typical binary because it contains all dependencies

## Troubleshooting

If you encounter issues with the executable:

1. Make sure Node.js is installed and in your PATH
2. Check that you have the necessary permissions to execute the file
3. On Unix-like systems, you may need to make the file executable with `chmod +x infinite-context`
4. If you're using OpenAI features, make sure your API key is set correctly
