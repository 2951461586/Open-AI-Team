import { createSkillResult } from '../skill-protocol.mjs';

const BOT_COMMANDS = {
  help: {
    command: '/help',
    description: 'Show available commands and help information',
    usage: '/help [command]',
    handler: 'handleHelp',
  },
  status: {
    command: '/status',
    description: 'Show current system status',
    usage: '/status',
    handler: 'handleStatus',
  },
  skills: {
    command: '/skills',
    description: 'List all available skills',
    usage: '/skills',
    handler: 'handleSkills',
  },
  reset: {
    command: '/reset',
    description: 'Reset conversation context',
    usage: '/reset',
    handler: 'handleReset',
  },
  language: {
    command: '/language',
    description: 'Switch interface language',
    usage: '/language <en|zh|ja>',
    handler: 'handleLanguage',
  },
  model: {
    command: '/model',
    description: 'Switch AI model',
    usage: '/model <model-name>',
    handler: 'handleModel',
  },
};

export class BotCommandRegistry {
  constructor(options = {}) {
    this.commands = new Map();
    this.aliases = new Map();
    this.defaultHandler = options.defaultHandler || null;
    this.contextProviders = options.contextProviders || {};
    
    for (const [id, cmd] of Object.entries(BOT_COMMANDS)) {
      this.register(id, cmd);
    }
  }

  register(id, { command, description, usage, handler, aliases = [] }) {
    this.commands.set(id, {
      id,
      command,
      description,
      usage,
      handler: typeof handler === 'string' ? this[handler]?.bind(this) : handler,
    });
    
    for (const alias of aliases) {
      this.aliases.set(alias, id);
    }
  }

  unregister(id) {
    const cmd = this.commands.get(id);
    if (cmd) {
      for (const [alias, cmdId] of this.aliases) {
        if (cmdId === id) this.aliases.delete(alias);
      }
    }
    return this.commands.delete(id);
  }

  resolveCommand(input = '') {
    const text = String(input || '').trim();
    
    for (const [id, cmd] of this.commands) {
      if (text.toLowerCase() === cmd.command.toLowerCase()) {
        return { id, command: cmd, args: '' };
      }
      if (text.toLowerCase().startsWith(cmd.command.toLowerCase() + ' ')) {
        return { id, command: cmd, args: text.slice(cmd.command.length).trim() };
      }
    }
    
    for (const [alias, cmdId] of this.aliases) {
      if (text.toLowerCase() === alias.toLowerCase()) {
        const cmd = this.commands.get(cmdId);
        return { id: cmdId, command: cmd, args: '' };
      }
    }
    
    return null;
  }

  async execute(commandInput, context = {}) {
    const resolved = this.resolveCommand(commandInput);
    
    if (!resolved) {
      return createSkillResult({
        ok: false,
        error: 'unknown_command',
        data: { message: `Unknown command. Type /help for available commands.` },
      });
    }

    try {
      const { command, args } = resolved;
      const handlerContext = {
        ...context,
        args,
        command: command.command,
        botCommands: this,
      };

      if (typeof command.handler === 'function') {
        const result = await command.handler(handlerContext);
        return createSkillResult({ ok: true, data: result });
      }

      return createSkillResult({
        ok: false,
        error: 'handler_not_implemented',
        data: { message: `Command ${command.command} handler not implemented.` },
      });
    } catch (error) {
      return createSkillResult({
        ok: false,
        error: `command_execution_failed: ${error.message}`,
      });
    }
  }

  async handleHelp(context = {}) {
    const { args } = context;
    
    if (args) {
      const resolved = this.resolveCommand(args);
      if (resolved?.command) {
        return {
          message: `*${resolved.command.command}*\n\n${resolved.command.description}\n\nUsage: ${resolved.command.usage}`,
        };
      }
      return { message: `Unknown command: ${args}` };
    }

    let response = '*Available Commands:*\n\n';
    for (const [id, cmd] of this.commands) {
      response += `${cmd.command} - ${cmd.description}\n`;
    }
    response += '\n_Type /help <command> for detailed information._';
    
    return { message: response };
  }

  async handleStatus(context = {}) {
    const providers = this.contextProviders;
    const status = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };

    if (providers.getStatus) {
      try {
        status.system = await providers.getStatus();
      } catch (e) {
        status.system = { error: e.message };
      }
    }

    return {
      message: `*System Status*\n\nUptime: ${Math.floor(status.uptime)}s\nMemory: ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB\nTime: ${status.timestamp}`,
    };
  }

  async handleSkills(context = {}) {
    if (!this.contextProviders.listSkills) {
      return { message: 'Skills listing not available.' };
    }

    try {
      const skills = await this.contextProviders.listSkills();
      let response = '*Available Skills:*\n\n';
      for (const skill of skills) {
        response += `• *${skill.name}* - ${skill.description}\n`;
      }
      return { message: response };
    } catch (error) {
      return { message: `Failed to list skills: ${error.message}` };
    }
  }

  async handleReset(context = {}) {
    const sessionId = context.sessionId || 'default';
    
    if (this.contextProviders.resetSession) {
      try {
        await this.contextProviders.resetSession(sessionId);
        return { message: 'Conversation context has been reset.' };
      } catch (error) {
        return { message: `Reset failed: ${error.message}` };
      }
    }
    
    return { message: 'Reset functionality not available.' };
  }

  async handleLanguage(context = {}) {
    const { args } = context;
    const validLanguages = ['en', 'zh', 'ja', 'ko'];
    const lang = (args || '').toLowerCase().trim();

    if (!validLanguages.includes(lang)) {
      return { message: `Invalid language. Supported: ${validLanguages.join(', ')}` };
    }

    if (this.contextProviders.setLanguage) {
      try {
        await this.contextProviders.setLanguage(lang);
        return { message: `Language changed to ${lang}.` };
      } catch (error) {
        return { message: `Failed to change language: ${error.message}` };
      }
    }

    return { message: 'Language change not available.' };
  }

  async handleModel(context = {}) {
    const { args } = context;
    
    if (!args) {
      return { message: 'Please specify a model name.' };
    }

    if (this.contextProviders.setModel) {
      try {
        await this.contextProviders.setModel(args);
        return { message: `Model changed to ${args}.` };
      } catch (error) {
        return { message: `Failed to change model: ${error.message}` };
      }
    }

    return { message: 'Model change not available.' };
  }

  listCommands() {
    return [...this.commands.values()].map((cmd) => ({
      id: cmd.id,
      command: cmd.command,
      description: cmd.description,
      usage: cmd.usage,
    }));
  }
}

export function createBotCommandRegistry(options = {}) {
  return new BotCommandRegistry(options);
}

export default {
  BotCommandRegistry,
  createBotCommandRegistry,
  BOT_COMMANDS,
};
