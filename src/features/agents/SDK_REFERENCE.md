# Tài liệu tham khảo Claude Agent SDK — Request & Response

Tài liệu này mô tả **toàn bộ** các tham số của lời gọi `query({ prompt, options })` (request) và
toàn bộ các loại message trong `SDKMessage` (response) mà gói `@anthropic-ai/claude-agent-sdk`
cung cấp, đang được dùng bởi `AgentsService.run()` tại
`src/features/agents/agents.service.ts`. Nguồn tham khảo:
`node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`.

```ts
import { query, type Options, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

async run(prompt: string, options?: Options): Promise<SDKMessage[]> {
  const messages: SDKMessage[] = [];

  const result = query({
    prompt,
    options: {
      model: 'claude-sonnet-5',
      ...options,
    },
  });

  for await (const message of result) {
    messages.push(message);
  }

  return messages;
}
```

`query()` trả về một `Query` — thực chất là một `AsyncGenerator<SDKMessage, void>`. Nghĩa là mỗi
lần Claude "nói" hay "làm" gì đó (trả lời, gọi tool, kết thúc lượt...) thì một `SDKMessage` mới
được đẩy ra qua vòng lặp `for await`. `AgentsService.run()` hiện tại chỉ gom hết các message này
vào một mảng rồi trả về nguyên xi — chưa lọc hay xử lý gì cả.

## 1. Request — `Options` (những gì bạn có thể truyền vào)

Toàn bộ field đều là **optional**. Nói dễ hiểu: `Options` giống như "bảng điều khiển" — bạn cấu
hình Claude sẽ chạy với model nào, được dùng tool gì, giới hạn ngân sách bao nhiêu, có nhớ hội
thoại cũ không, v.v.

### 1.1. Model, hành vi trả lời, chi phí

| Field | Kiểu | Giải thích chi tiết |
| --- | --- | --- |
| `model` | `string` | Model Claude sẽ dùng, ví dụ `'claude-sonnet-5'`, `'claude-opus-5'`. Nếu không truyền thì CLI dùng model mặc định. |
| `fallbackModel` | `string` | Model dự phòng (có thể liệt kê nhiều, cách nhau bằng dấu phẩy) — nếu model chính bị quá tải/lỗi, hệ thống tự động thử model dự phòng. Model chính sẽ được thử lại vào đầu mỗi lượt mới, nên một lần lỗi tạm thời không làm "hạ cấp" vĩnh viễn cả phiên. |
| `effort` | `'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'` | Mức độ "cố gắng suy nghĩ" của model — càng cao thì trả lời càng sâu nhưng càng chậm/tốn hơn. |
| `thinking` | `ThinkingConfig` | Cấu hình chế độ "suy luận mở rộng" (extended thinking): `{type:'adaptive'}` (model tự quyết định suy nghĩ bao nhiêu — mặc định với model hỗ trợ), `{type:'enabled', budgetTokens}` (giới hạn cứng số token dùng để suy nghĩ), hoặc `{type:'disabled'}` (tắt hẳn). |
| `maxThinkingTokens` | `number` | **Đã lỗi thời (deprecated)** — dùng `thinking` thay thế. |
| `maxTurns` | `number` | Số lượt hội thoại (turn) tối đa trước khi query tự dừng. Một turn = 1 tin nhắn user + 1 phản hồi assistant. |
| `maxBudgetUsd` | `number` | Ngân sách tối đa tính bằng USD. Nếu vượt, query dừng lại và trả về kết quả với `subtype: 'error_max_budget_usd'`. |
| `taskBudget` | `{ total: number }` | Ngân sách token phía API — cho model "biết" nó còn bao nhiêu token để tự canh chỉnh việc dùng tool, kết thúc sớm trước khi hết hạn mức. |
| `outputFormat` | `OutputFormat` | Định dạng đầu ra có cấu trúc, ví dụ `{ type: 'json_schema', schema: {...} }` để bắt Claude trả về đúng schema JSON bạn yêu cầu. |

### 1.2. Quyền dùng tool (tools & permissions)

| Field | Kiểu | Giải thích chi tiết |
| --- | --- | --- |
| `tools` | `string[] \| { type: 'preset'; preset: 'claude_code' }` | Tập tool cơ bản được phép dùng. Truyền `[]` để tắt hết tool có sẵn. |
| `allowedTools` | `string[]` | Danh sách tool được **tự động cho phép** — không hỏi xin quyền, chạy thẳng. |
| `disallowedTools` | `string[]` | Danh sách tool bị **loại bỏ hoàn toàn** khỏi ngữ cảnh của model — dù có nằm trong `allowedTools` cũng không dùng được. |
| `toolAliases` | `Record<string, string>` | Đổi tên tool trước khi thực thi. Ví dụ `{ Bash: 'mcp__workspace__bash' }` — khi model gọi tool `Bash`, hệ thống sẽ chuyển hướng sang tool MCP tương ứng thay vì lỗi "tool không tồn tại". |
| `permissionMode` | `PermissionMode` | Chế độ xin quyền: `'default'` (hỏi khi thao tác nguy hiểm), `'acceptEdits'` (tự đồng ý sửa file), `'bypassPermissions'` (bỏ qua hết — cần bật kèm `allowDangerouslySkipPermissions`), `'plan'` (chế độ lên kế hoạch, không thực thi tool thật), `'dontAsk'` (không hỏi, tự động từ chối nếu chưa được duyệt trước), `'auto'` (dùng model classifier để tự động duyệt/từ chối). Xem chi tiết ở mục 3.4 bên dưới. |
| `allowDangerouslySkipPermissions` | `boolean` | Bắt buộc phải bật `true` nếu dùng `permissionMode: 'bypassPermissions'` — một biện pháp an toàn để tránh bỏ qua quyền một cách vô tình. |
| `canUseTool` | `CanUseTool` | Callback tùy chỉnh do bạn viết, được gọi **trước mỗi lần** tool chạy để quyết định cho phép/từ chối/hỏi lại người dùng. |
| `permissionPromptToolName` | `string` | Tên một MCP tool dùng để hiển thị hộp thoại xin quyền, thay cho cơ chế mặc định. |
| `planModeInstructions` | `string` | Thay thế nội dung hướng dẫn mặc định khi ở chế độ `plan` (lên kế hoạch mà chưa thực thi code). |

### 1.3. Thư mục làm việc, môi trường chạy

| Field | Kiểu | Giải thích chi tiết |
| --- | --- | --- |
| `cwd` | `string` | Thư mục làm việc của phiên. Mặc định là `process.cwd()`. |
| `additionalDirectories` | `string[]` | Các thư mục **tuyệt đối** khác mà Claude được phép truy cập, ngoài `cwd`. |
| `env` | `{ [envVar]: string \| undefined }` | Biến môi trường cho tiến trình con. **Lưu ý:** giá trị này **thay thế hoàn toàn** `process.env`, không gộp — nếu vẫn cần các biến như `PATH`, `HOME` thì phải tự spread `process.env` vào. |
| `executable` | `'bun' \| 'deno' \| 'node'` | Runtime JS dùng để chạy Claude Code. Tự động phát hiện nếu không truyền. |
| `executableArgs` | `string[]` | Tham số bổ sung truyền cho runtime JS. |
| `extraArgs` | `Record<string, string \| null>` | Tham số CLI bổ sung. Key là tên cờ (không có `--`), value là giá trị; `null` nghĩa là cờ boolean (không kèm giá trị). |
| `pathToClaudeCodeExecutable` | `string` | Đường dẫn tới file thực thi Claude Code. Dùng bản build sẵn nếu không truyền. |
| `spawnClaudeCodeProcess` | `(options: SpawnOptions) => SpawnedProcess` | Hàm tự viết để khởi chạy tiến trình Claude Code — hữu ích khi muốn chạy trong VM, container, hoặc môi trường từ xa thay vì spawn cục bộ mặc định. |
| `sandbox` | `SandboxSettings` | Cấu hình chạy lệnh trong sandbox cách ly (giới hạn truy cập filesystem/network ở mức tiến trình). Lưu ý: quyền truy cập file/network cụ thể vẫn phải cấu hình qua permission rules (`Read`, `Edit`, `WebFetch`), field này chỉ bật/tắt cơ chế sandbox. |

### 1.4. Phiên làm việc (session) — resume, lưu trữ

| Field | Kiểu | Giải thích chi tiết |
| --- | --- | --- |
| `continue` | `boolean` | Tiếp tục hội thoại gần nhất trong `cwd` thay vì tạo mới. Không dùng chung với `resume`. |
| `resume` | `string` | ID của session muốn tiếp tục — load lại toàn bộ lịch sử hội thoại đó. |
| `sessionId` | `string` | Đặt ID cụ thể (phải là UUID hợp lệ) cho session thay vì để tự sinh. |
| `forkSession` | `boolean` | Khi resume, tạo một session ID **mới** (fork) thay vì tiếp tục ghi đè lên session cũ. |
| `resumeSessionAt` | `string` | Chỉ resume tới đúng message có UUID này (resume một phần, không lấy toàn bộ lịch sử). |
| `resumeDropsTurn` | `string` | Khai báo UUID của turn mà một lần resume "cắt bớt" (`resumeSessionAt`) dự định bỏ đi. Hệ thống sẽ kiểm tra và từ chối resume nếu phần bị cắt còn chứa dữ liệu quan trọng chưa được xử lý. |
| `persistSession` | `boolean` (mặc định `true`) | Đặt `false` để **không lưu** session xuống đĩa (`~/.claude/projects/`) — hữu ích cho các tác vụ tạm thời/tự động không cần giữ lịch sử. |
| `sessionStore` | `SessionStore` | Đồng bộ (mirror) transcript của session ra một kho lưu trữ ngoài, song song với việc ghi cục bộ. *(alpha)* |
| `sessionStoreFlush` | `SessionStoreFlush` (mặc định `'batched'`) | Mức độ "xả" (flush) dữ liệu ra `sessionStore` — gom theo lô hay ghi ngay. *(alpha)* |
| `loadTimeoutMs` | `number` (mặc định `60000`) | Thời gian chờ tối đa cho `sessionStore.load()`/`listSubkeys()` khi resume, tránh treo vô thời hạn. *(alpha)* |
| `title` | `string` | Tiêu đề tùy chỉnh cho session mới, thay vì tự sinh từ tin nhắn đầu tiên. |

### 1.5. Hook, callback, dialog

| Field | Kiểu | Giải thích chi tiết |
| --- | --- | --- |
| `hooks` | `Partial<Record<HookEvent, HookCallbackMatcher[]>>` | Đăng ký callback cho các sự kiện vòng đời (`PreToolUse`, `PostToolUse`, `Stop`, ...) — có thể chỉnh sửa hành vi, thêm ngữ cảnh, hoặc chặn hành động. |
| `includeHookEvents` | `boolean` (mặc định `false`) | Bật thì các message hệ thống `hook_started`/`hook_progress`/`hook_response` sẽ được phát ra trong response cho **mọi** loại hook. |
| `onElicitation` | `OnElicitation` | Callback xử lý khi một MCP server yêu cầu người dùng nhập thêm dữ liệu (form hoặc xác thực qua URL) mà chưa có hook nào xử lý. |
| `onUserDialog` | `OnUserDialog` | Callback xử lý các dialog chặn luồng (`request_user_dialog`) mà CLI yêu cầu host hiển thị cho người dùng. |
| `supportedDialogKinds` | `string[]` | Danh sách loại dialog mà `onUserDialog` của bạn thực sự hiển thị được. Bắt buộc phải khai báo cùng `onUserDialog` thì CLI mới gửi các dialog đó. |
| `perTaskStopAffordance` | `boolean` | Khai báo rằng ứng dụng của bạn có nút "dừng" cho từng task nền riêng lẻ — khi đó lệnh ngắt (interrupt) sẽ không giết chết các task nền đang chạy. |
| `stderr` | `(data: string) => void` | Callback nhận log stderr từ tiến trình Claude Code — hữu ích để debug. |

### 1.6. MCP, plugin, skill, agent con

| Field | Kiểu | Giải thích chi tiết |
| --- | --- | --- |
| `mcpServers` | `Record<string, McpServerConfig>` | Cấu hình các MCP server, key là tên server. |
| `strictMcpConfig` | `boolean` | Chỉ dùng MCP server được truyền qua `mcpServers` (và server khai báo trong `agents`), **bỏ qua** mọi cấu hình MCP khác (file `.mcp.json`, user settings, plugin...). |
| `plugins` | `SdkPluginConfig[]` | Danh sách plugin cục bộ cần nạp, dạng `{ type: 'local', path }`. |
| `skills` | `string[] \| 'all'` | Danh sách skill được bật cho session. `'all'` bật hết skill tìm thấy được. |
| `agent` | `string` | Tên một agent áp dụng cho luồng chính (system prompt, giới hạn tool, model riêng của agent đó) — agent này phải được định nghĩa sẵn trong `agents` hoặc trong settings. |
| `agents` | `Record<string, AgentDefinition>` | Định nghĩa các subagent tùy chỉnh có thể được gọi qua tool Agent (giống các subagent trong Claude Code). |
| `toolConfig` | `ToolConfig` | Cấu hình riêng cho từng tool có sẵn. |
| `enableFileCheckpointing` | `boolean` | Bật thì hệ thống sẽ backup file trước mỗi lần sửa, cho phép "tua lại" (rewind) trạng thái file bằng `Query.rewindFiles()`. |
| `agentProgressSummaries` | `boolean` | Định kỳ (~30 giây) sinh một câu tóm tắt tiến độ ngắn cho các subagent đang chạy (ví dụ "Đang phân tích module xác thực"), hiển thị qua field `summary` trong message `task_progress`. |
| `forwardSubagentText` | `boolean` | Mặc định chỉ chuyển tiếp phần tool_use/tool_result từ subagent ra ngoài. Bật field này để chuyển tiếp **toàn bộ** nội dung văn bản/suy luận của subagent, cho phép hiển thị transcript lồng nhau đầy đủ. |

### 1.7. System prompt, settings

| Field | Kiểu | Giải thích chi tiết |
| --- | --- | --- |
| `systemPrompt` | `string \| string[] \| {type:'custom', prompt, snapshot?} \| {type:'preset', preset:'claude_code', append?, excludeDynamicSections?, snapshot?}` | Cấu hình system prompt: chuỗi tùy chỉnh, mảng block, hoặc dùng preset mặc định của Claude Code (có thể `append` thêm hướng dẫn). `snapshot: true` được khuyến nghị — "chốt" system prompt lại trong suốt hội thoại để không phá vỡ prompt cache và không làm mất phần suy luận (thinking) đã tính trước đó khi prompt thay đổi giữa chừng. |
| `settings` | `string \| Settings` | Cấu hình bổ sung — có thể là đường dẫn tới file settings JSON hoặc object trực tiếp. Đây là lớp có độ ưu tiên **cao nhất** trong các lớp settings do người dùng kiểm soát. |
| `managedSettings` | `Settings` | Settings ở cấp "chính sách" do tiến trình cha (ứng dụng nhúng SDK) cung cấp — chỉ áp dụng phần **hạn chế thêm**, không thể dùng để nới lỏng quyền đã bị khóa bởi admin. |
| `settingSources` | `SettingSource[]` | Chọn những nguồn settings trên ổ đĩa sẽ được nạp: `'user'`, `'project'`, `'local'`. Không truyền thì nạp hết; truyền `[]` để tắt hoàn toàn (cô lập SDK khỏi settings trên máy). Phải có `'project'` thì mới đọc được file `CLAUDE.md`. |

### 1.8. Debug, hủy request

| Field | Kiểu | Giải thích chi tiết |
| --- | --- | --- |
| `abortController` | `AbortController` | Dùng để hủy query giữa chừng. Gọi `.abort()` thì query dừng và dọn dẹp tài nguyên. |
| `debug` | `boolean` | Bật log debug chi tiết (tương đương cờ `--debug`). |
| `debugFile` | `string` | Ghi log debug ra file cụ thể (tự động bật `debug: true`). |
| `betas` | `SdkBeta[]` | Bật các tính năng beta, ví dụ `'context-1m-2025-08-07'` (cửa sổ ngữ cảnh 1 triệu token, chỉ dòng Sonnet 4/4.5). |
| `includePartialMessages` | `boolean` | Bật thì các message stream từng phần (`SDKPartialAssistantMessage`) sẽ được phát ra trong lúc model đang sinh câu trả lời, thay vì chỉ nhận message hoàn chỉnh. |
| `promptSuggestions` | `boolean` | Bật thì sau mỗi turn, hệ thống phát ra thêm message `prompt_suggestion` — gợi ý câu hỏi tiếp theo có thể người dùng sẽ hỏi. |

## 2. Response — `SDKMessage` (những gì bạn nhận được)

`SDKMessage` là một **union type có phân biệt** (discriminated union) — muốn biết message đang cầm
trên tay là loại gì thì kiểm tra field `type` (và `subtype` nếu `type` là `'system'` hoặc
`'result'`). Có tổng cộng **38 loại message**. Với một lệnh `run(prompt)` đơn giản, bạn thường sẽ
gặp chủ yếu:

1. **`SDKSystemMessage`** (`type: 'system', subtype: 'init'`) — phát ra **một lần** ở đầu, chứa
   thông tin phiên (model đang dùng, danh sách tool, mcp server, quyền...).
2. **`SDKAssistantMessage`** (`type: 'assistant'`) — từng khối nội dung Claude trả lời (có thể có
   nhiều message liên tiếp nếu câu trả lời dài / có gọi tool).
3. **`SDKUserMessage`** (`type: 'user'`) — CLI tự thêm vào khi có `tool_result` (kết quả chạy
   tool) trả về cho Claude.
4. **`SDKResultMessage`** (`type: 'result'`) — phát ra **đúng một lần cuối turn**, báo hiệu turn đã
   xong, kèm chi phí (`total_cost_usd`), số token dùng (`usage`), và kết quả cuối cùng.

Ngoài ra còn rất nhiều message "phụ trợ" khác (tiến độ task, thông báo hệ thống, hook, rate limit,
...) — liệt kê đầy đủ bên dưới.

### 2.1. `SDKAssistantMessage` — `type: 'assistant'`

Mỗi khối nội dung trong câu trả lời của Claude. Khi trả lời đang được stream, CLI phát ra **một
message riêng cho mỗi khối nội dung hoàn tất**, nên nhiều message liên tiếp có thể cùng chung
`message.id` nhưng mỗi cái chỉ chứa một khối trong `message.content`; lúc đó `stop_reason` là
`null` và `usage` chưa phải số liệu cuối — số liệu cuối cùng nằm ở message `result`.

| Field | Kiểu | Giải thích |
| --- | --- | --- |
| `message` | `BetaMessage` | Message theo định dạng Anthropic Messages API: `id`, `model`, các khối `content` (text/thinking/tool_use...), `stop_reason`, `usage`. |
| `parent_tool_use_id` | `string \| null` | Khác `null` nếu message này được sinh ra bên trong một subagent (do một tool_use khởi chạy). |
| `error` | `SDKAssistantMessageError?` | Mã lỗi nếu có: `authentication_failed`, `oauth_org_not_allowed`, `account_on_hold`, `billing_error`, `rate_limit`, `overloaded`, `invalid_request`, `model_not_found`, `server_error`, `unknown`, `max_output_tokens`. |
| `uuid` | `UUID` | ID của message. |
| `session_id` | `string` | ID của phiên. |
| `request_id` | `string?` | ID request phía API. |
| `user_message_uuid` | `string?` | UUID của tin nhắn user đã kích hoạt turn này — chỉ gắn trên message trả lời **đầu tiên** của turn, giúp bên nhận nối kết quả với tin nhắn đã gửi. |
| `resumed_from_incomplete_thinking` | `true?` | Turn này là phần tiếp nối của một turn trước bị cắt ngang giữa lúc đang "suy nghĩ" (do đạt giới hạn token đầu ra). |
| `supersedes` | `UUID[]?` | Danh sách UUID các message trước đó bị **thay thế** bởi message này (trường hợp model bị từ chối trả lời và retry). |
| `aborted` | `true?` | `true` nếu message bị cắt ngang do có lệnh ngắt/hủy trước khi stream hoàn tất. |
| `subagent_type` | `string?` | Loại subagent đã sinh ra message này (nếu có). |
| `task_description` | `string?` | Mô tả task mà subagent đang thực hiện. |
| `timestamp` | `string?` | Thời điểm (ISO) khối nội dung này hoàn tất, chỉ mang tính hiển thị. |
| `context_usage` | `SDKContextUsage?` | Báo cáo có cấu trúc về mức sử dụng ngữ cảnh (tương đương lệnh `/context`), chỉ có trên message đặc biệt trả về từ lệnh đó. |

### 2.2. `SDKUserMessage` / `SDKUserMessageReplay` — `type: 'user'`

`SDKUserMessage` là message user gửi lên để bắt đầu một turn, **hoặc** message CLI tự thêm vào để
chứa `tool_result` (kết quả chạy tool) trả lời lại `tool_use` của Claude. `SDKUserMessageReplay`
có cùng cấu trúc nhưng là bản phát lại từ lịch sử cũ (`isReplay: true`).

| Field | Kiểu | Giải thích |
| --- | --- | --- |
| `message` | `MessageParam` | Message user theo Anthropic Messages API: chuỗi hoặc mảng khối nội dung (text/image/document/tool_result...). |
| `parent_tool_use_id` | `string \| null` | Khác `null` nếu đây là message của một subagent. |
| `isSynthetic` | `boolean?` | `true` nếu message này không do người dùng thật gõ ra (được hệ thống tự sinh). |
| `tool_use_result` | `unknown?` | Kết quả có cấu trúc đầy đủ của tool (khác với nội dung text đã rút gọn gửi cho model) — hình dạng tùy theo từng tool. |
| `priority` | `'now' \| 'next' \| 'later'?` | Độ ưu tiên xử lý message. |
| `origin` | `SDKMessageOrigin?` | Nguồn gốc message: người dùng thật (`human`), kênh khác (`channel`), phiên khác (`peer`), thông báo task (`task-notification`), điều phối viên (`coordinator`)... |
| `shouldQuery` | `boolean?` | Nếu `false`, message chỉ được thêm vào transcript mà **không** kích hoạt một turn mới — sẽ được gộp vào message tiếp theo có kích hoạt turn. |
| `timestamp` | `string?` | Thời điểm tạo message (ISO). |
| `uuid` / `session_id` | `UUID` / `string` | ID message/phiên (bắt buộc ở `SDKUserMessageReplay`, tùy chọn ở `SDKUserMessage`). |
| `subagent_type` | `string?` | Loại subagent đã sinh message. |
| `task_description` | `string?` | Mô tả task của subagent. |
| `isReplay` | `true` | **Chỉ có ở `SDKUserMessageReplay`** — đánh dấu đây là bản phát lại. |
| `file_attachments` | `unknown[]?` | **Chỉ có ở `SDKUserMessageReplay`.** |

### 2.3. `SDKResultMessage` — `type: 'result'` (`SDKResultSuccess \| SDKResultError`)

Đây là message **quan trọng nhất để biết turn đã kết thúc** — CLI phát ra đúng một message này sau
khi mọi message assistant/user/stream_event của turn đó đã xong.

Các field chung cho cả hai nhánh (`subtype` quyết định là thành công hay lỗi):

| Field | Kiểu | Giải thích |
| --- | --- | --- |
| `duration_ms` / `duration_api_ms` | `number` | Thời gian thực tế / thời gian gọi API của turn (mili giây). |
| `is_error` | `boolean` | Turn có kết thúc bằng lỗi hay không. |
| `num_turns` | `number` | Số turn đã dùng. |
| `stop_reason` | `string \| null` | Lý do model dừng lại. |
| `total_cost_usd` | `number` | **Chi phí ước tính lũy kế** (USD) cho cả lần gọi `query()` này — số liệu chạy dồn qua các turn, nên chỉ cần đọc kết quả mới nhất, không cần cộng dồn thủ công. |
| `usage` | `NonNullableUsage` | Số token dùng — **chỉ tính vòng lặp chính**, không bao gồm subagent/sidechain. |
| `modelUsage` | `Record<string, ModelUsage>` | Tổng số liệu theo từng model, tính **toàn bộ** pipeline (vòng lặp chính + subagent + các lệnh gọi nội bộ như nén ngữ cảnh). Nên dùng field này để tính chi phí/token chính xác thay vì `usage`. |
| `permission_denials` | `SDKPermissionDenial[]` | Danh sách các lần gọi tool bị từ chối tự động trong turn này. |
| `queued_turn_count` | `number?` | Số lượt gửi của người dùng đang còn xếp hàng chờ xử lý khi kết quả này được tạo ra. |
| `terminal_reason` | `TerminalReason?` | Lý do phiên/turn kết thúc (nếu có). |
| `fast_mode_state` / `fast_mode_disabled_reason` | — | Trạng thái chế độ "fast mode". |
| `origin` | `SDKMessageOrigin?` | Nguồn gốc. |
| `uuid` / `session_id` | `UUID` / `string` | ID message/phiên. |

**`SDKResultSuccess`** (`subtype: 'success'`) — turn thành công, có thêm:
`ttft_ms?` (thời gian tới token đầu tiên), `ttft_stream_ms?`, `time_to_request_ms?`,
`user_message_uuid?`, `request_sent_wall_ms?`, `time_to_request_from_spawn_ms?`,
`warm_spare_claimed?`, `time_origin_ms?`, `api_error_status?: number | null`,
**`result: string`** (nội dung trả lời cuối cùng — hoặc nội dung lỗi nếu `is_error` là `true`),
`structured_output?: unknown` (dữ liệu có cấu trúc nếu dùng `outputFormat`),
`deferred_tool_use?: SDKDeferredToolUse`.

**`SDKResultError`** (`subtype: 'error_during_execution' | 'error_max_turns' |
'error_max_budget_usd' | 'error_max_structured_output_retries'`) — turn thất bại, có thêm:
`errors: string[]` (danh sách lỗi cụ thể).

### 2.4. `SDKSystemMessage` — `type: 'system'`, `subtype: 'init'`

Thông tin phiên, phát ra ở **đầu mỗi turn** trước mọi message khác của turn đó.

| Field | Kiểu | Giải thích |
| --- | --- | --- |
| `agents` | `string[]?` | Danh sách tên agent khả dụng. |
| `apiKeySource` | `ApiKeySource` | Nguồn credential dùng để gọi API (biến môi trường, helper, `/login`, ...). |
| `betas` | `string[]?` | Các cờ beta đang bật. |
| `claude_code_version` | `string` | Phiên bản CLI. |
| `cwd` | `string` | Thư mục làm việc. |
| `tools` | `string[]` | Danh sách tên tool khả dụng. |
| `mcp_servers` | `{ name, status }[]` | Các MCP server đã cấu hình và trạng thái kết nối. |
| `model` | `string` | Model đang dùng. |
| `permissionMode` | `PermissionMode` | Chế độ quyền đang áp dụng. |
| `slash_commands` | `string[]` | Danh sách slash command khả dụng. |
| `terminal_slash_commands` | `string[]?` | Tập con của `slash_commands` chỉ dùng được ở terminal cục bộ. |
| `output_style` | `string` | Kiểu định dạng đầu ra đang áp dụng. |
| `skills` | `string[]` | Các skill đang được bật. |
| `plugins` | `{ name, path, version? }[]` | Các plugin đã nạp. |
| `effort` | `'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max' \| null?` | Mức effort sẽ dùng cho request tiếp theo. |
| `capabilities` | `string[]?` | Danh sách năng lực giao thức mà CLI này hỗ trợ — dùng để "dò tính năng" thay vì so sánh phiên bản. |
| `uuid` / `session_id` | `UUID` / `string` | ID message/phiên. |

### 2.5. `SDKPartialAssistantMessage` — `type: 'stream_event'`

Chỉ phát ra khi bật `includePartialMessages: true`. Đây là **từng sự kiện stream thô** của
Anthropic Messages API (mịn hơn `SDKAssistantMessage` — cho phép hiển thị hiệu ứng gõ chữ theo
thời gian thực).

| Field | Kiểu | Giải thích |
| --- | --- | --- |
| `event` | `BetaRawMessageStreamEvent` | Một sự kiện stream (`message_start`, `content_block_start/delta/stop`, `message_delta`, `message_stop`). |
| `parent_tool_use_id` | `string \| null` | Liên kết tới subagent (nếu có). |
| `uuid` / `session_id` | `UUID` / `string` | ID message/phiên. |
| `ttft_ms` | `number?` | Thời gian tới token đầu tiên. |
| `user_message_uuid` | `string?` | Chỉ gắn trên sự kiện stream đầu tiên (không tính ping) của turn. |

### 2.6. Các message hệ thống khác (`type: 'system'`)

Tất cả đều có chung `type: 'system'`, `subtype: <tên>`, `uuid: UUID`, `session_id: string`; bảng
dưới liệt kê các field **thêm** riêng của từng loại.

| Subtype | Field thêm | Ý nghĩa |
| --- | --- | --- |
| `api_retry` (`SDKAPIRetryMessage`) | `attempt`, `max_retries`, `retry_delay_ms`, `error_status: number \| null`, `error` | Một request API lỗi (có thể retry được) và sắp được thử lại sau một khoảng trễ. |
| `control_request_progress` (`SDKControlRequestProgressMessage`) | `request_id`, `status: 'started' \| 'api_retry'`, `attempt?`, `max_retries?`, `retry_delay_ms?`, `error_status?` | Tiến độ của một control-request chạy lâu do client khởi tạo. |
| `model_refusal_fallback` (`SDKModelRefusalFallbackMessage`) | `trigger`, `direction`, `scope?`, `original_model`, `fallback_model`, `request_id`, `api_refusal_category?`, `api_refusal_explanation?`, `retracted_message_uuids?`, `refused_user_message_uuid?`, `content` | Model chính đã **từ chối trả lời** (refusal) và hệ thống tự động thử lại bằng model dự phòng. |
| `model_refusal_no_fallback` (`SDKModelRefusalNoFallbackMessage`) | `original_model`, `request_id`, `api_refusal_category?`, `api_refusal_explanation?`, `refused_user_message_uuid?`, `content` | Model từ chối trả lời và **không có** lượt thử lại nào (không cấu hình fallback). |
| `local_command_output` (`SDKLocalCommandOutputMessage`) | `content` | Kết quả xuất ra từ một slash command chạy cục bộ. |
| `hook_started` (`SDKHookStartedMessage`) | `hook_id`, `hook_name`, `hook_event` | Một hook bắt đầu chạy. |
| `hook_progress` (`SDKHookProgressMessage`) | `hook_id`, `hook_name`, `hook_event`, `stdout`, `stderr`, `output` | Tiến độ hook đang chạy. |
| `hook_response` (`SDKHookResponseMessage`) | `hook_id`, `hook_name`, `hook_event`, `output`, `stdout`, `stderr`, `exit_code?`, `outcome` | Kết quả cuối cùng của một hook. |
| `plugin_install` (`SDKPluginInstallMessage`) | `status`, `name?`, `error?` | Tiến độ cài đặt plugin ở chế độ headless. |
| `auth_status` (`SDKAuthStatusMessage`) | `isAuthenticating`, `output: string[]`, `error?` | Trạng thái xác thực tài khoản. |
| `task_notification` (`SDKTaskNotificationMessage`) | `task_id`, `tool_use_id?`, `status`, `output_file`, `summary`, `usage?`, `resource_links?`, `skip_transcript?`, `ambient?` | Một task nền (chạy ngầm) đã **hoàn tất/thất bại/dừng**. |
| `task_started` (`SDKTaskStartedMessage`) | `task_id`, `tool_use_id?`, `description`, `subagent_type?`, `is_backgrounded?`, `spawn_depth?`, `task_type?`, `workflow_name?`, `prompt?`, `skip_transcript?`, `ambient?` | Một task (subagent, lệnh nền...) vừa **bắt đầu**. |
| `task_updated` (`SDKTaskUpdatedMessage`) | `task_id`, `patch: { status?, description?, end_time?, total_paused_ms?, error?, is_backgrounded? }` | Một phần trạng thái của task thay đổi. |
| `task_progress` (`SDKTaskProgressMessage`) | `task_id`, `tool_use_id?`, `description`, `subagent_type?`, `usage`, `last_tool_name?`, `summary?` | Cập nhật tiến độ của task đang chạy (kèm tóm tắt nếu bật `agentProgressSummaries`). |
| `background_tasks_changed` (`SDKBackgroundTasksChangedMessage`) | `tasks: { task_id, task_type, description, ambient? }[]` | **Toàn bộ** danh sách task nền đang chạy — mỗi khi thay đổi, thay thế nguyên danh sách cũ bằng danh sách mới này. |
| `thinking_tokens` (`SDKThinkingTokensMessage`) | `estimated_tokens`, `estimated_tokens_delta` | Ước tính số token đang dùng để "suy nghĩ" (thời gian thực). |
| `session_state_changed` (`SDKSessionStateChangedMessage`) | `state: 'idle' \| 'running' \| 'requires_action'` | Trạng thái tổng thể của phiên thay đổi. |
| `commands_changed` (`SDKCommandsChangedMessage`) | `commands: SlashCommand[]` | Danh sách slash command thay đổi giữa phiên (ví dụ phát hiện thêm skill mới) — thay thế toàn bộ danh sách cũ. |
| `notification` (`SDKNotificationMessage`) | `key`, `text`, `priority`, `color?`, `timeout_ms?` | Thông báo dạng text ngắn từ hệ thống. |
| `files_persisted` (`SDKFilesPersistedEvent`) | `files: { filename, file_id }[]`, `failed: { filename, error }[]`, `processed_at` | Kết quả lưu file đính kèm (thành công/thất bại). |
| `memory_recall` (`SDKMemoryRecallMessage`) | `mode`, `memories: { path, scope, content? }[]` | Các "ký ức" (memory) liên quan được gợi nhớ và đưa vào turn hiện tại. |
| `elicitation_complete` (`SDKElicitationCompleteMessage`) | `mcp_server_name`, `elicitation_id` | Một MCP server xác nhận đã hoàn tất việc xin thông tin qua URL. |
| `permission_denied` (`SDKPermissionDeniedMessage`) | `tool_name`, `tool_use_id`, `agent_id?`, `decision_reason_type?`, `decision_reason?`, `message` | Một lệnh gọi tool bị **từ chối tự động** (không hỏi người dùng), ví dụ do chế độ `dontAsk` hoặc rule chặn. |
| `mirror_error` (`SDKMirrorErrorMessage`) | `error`, `key: { projectKey, sessionId, subpath? }` | Lỗi khi đồng bộ transcript ra kho lưu trữ ngoài (`sessionStore`). |
| `informational` (`SDKInformationalMessage`) | `content`, `level`, `tool_use_id?`, `prevent_continuation?` | Banner thông báo chung (không phải lỗi) — cảnh báo, gợi ý, kết quả slash command... |
| `status` (`SDKStatusMessage`) | `status: 'compacting' \| 'requesting' \| null`, `permissionMode?`, `compact_result?`, `compact_error?` | Trạng thái hoạt động hiện tại của Claude (đang nén ngữ cảnh, đang gọi API...). |
| `compact_boundary` (`SDKCompactBoundaryMessage`) | `compact_metadata: { trigger, pre_tokens, post_tokens?, duration_ms?, preserved_segment?, preserved_messages? }` | Đánh dấu **điểm nén ngữ cảnh** (compact) — khi hội thoại quá dài và bị tóm tắt lại để tiết kiệm token. |
| `worker_shutting_down` (`SDKWorkerShuttingDownMessage`) | `reason` | Tiến trình worker đang tắt có chủ đích (kèm lý do), không phải bị crash. |

### 2.7. Các message top-level còn lại (không phải `type: 'system'`)

| Loại message | Giá trị `type` | Field | Giải thích |
| --- | --- | --- | --- |
| `SDKToolProgressMessage` | `'tool_progress'` | `tool_use_id`, `tool_name`, `parent_tool_use_id`, `elapsed_time_seconds`, `task_id?`, `heartbeat?`, `subagent_type?`, `subagent_retry?`, `uuid`, `session_id` | Cập nhật tiến độ khi một tool đang chạy lâu (ví dụ Bash chạy lệnh mất nhiều thời gian). |
| `SDKToolUseSummaryMessage` | `'tool_use_summary'` | `summary`, `preceding_tool_use_ids: string[]`, `uuid`, `session_id` | Tóm tắt ngắn gọn kết quả của một chuỗi lệnh gọi tool trước đó. |
| `SDKRateLimitEvent` | `'rate_limit_event'` | `rate_limit_info: SDKRateLimitInfo` (`status`, `resetsAt?`, `rateLimitType?`, `utilization?`, `overageStatus?`, ...), `uuid`, `session_id` | Thông tin giới hạn tốc độ (rate limit) của tài khoản thay đổi. |
| `SDKPromptSuggestionMessage` | `'prompt_suggestion'` | `suggestion: string`, `uuid`, `session_id` | Gợi ý câu hỏi tiếp theo (chỉ phát ra khi bật `promptSuggestions`). |
| `SDKConversationResetMessage` | `'conversation_reset'` | `new_conversation_id: UUID`, `uuid`, `session_id` | Hội thoại bị reset (do `/clear`, thoát chế độ plan, hoặc bắt đầu phiên mới). |

## 3. Model, Role, Tool và các hằng số (enum) khác của SDK

Kết quả tìm trực tiếp trong `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` và
`sdk-tools.d.ts` (phiên bản `^0.3.258` đang cài trong project).

### 3.1. Model

SDK **không** khai báo một enum đóng cho model — field `model` (trong `Options` và
`AgentDefinition`) chỉ có kiểu `string`, để tương lai model mới ra mắt không cần cập nhật SDK.
Theo comment/ví dụ trong `sdk.d.ts` và thông tin phiên bản hiện tại:

| Alias ngắn | Model ID đầy đủ | Ghi chú |
| --- | --- | --- |
| `'sonnet'` | `claude-sonnet-5` | Model mặc định hợp lý cho hầu hết tác vụ — đang là default trong `agents.config.ts`. |
| `'opus'` | `claude-opus-5` | Mạnh nhất, chậm/đắt hơn. |
| `'fable'` | `claude-fable-5-1` | Dòng Fable. |
| `'haiku'` | `claude-haiku-4-5-20251001` | Nhanh, rẻ nhất — hợp cho subagent/tác vụ đơn giản. |
| `'inherit'` | — | **Chỉ dùng trong `AgentDefinition.model`** (subagent): kế thừa đúng model của luồng chính thay vì chọn model riêng. |

Áp dụng vào 2 chỗ:

- `Options.model` — model cho luồng chính của `query()`. Không set thì CLI tự chọn default.
- `Options.fallbackModel` — model dự phòng (string, có thể liệt kê nhiều, phân tách bằng dấu
  phẩy) nếu model chính quá tải.
- `AgentDefinition.model` — model riêng cho một subagent định nghĩa trong `Options.agents`,
  chấp nhận alias, model ID đầy đủ, hoặc `'inherit'`.

Vì đây là chuỗi tự do, cách chắc chắn nhất để biết model **thật sự đang chạy** là đọc lại từ
response — field `model` trên `SDKSystemMessage` (mục 2.4) phản ánh đúng model CLI đã chọn cho
phiên, kể cả khi bạn không truyền `Options.model`.

### 3.2. Role

Có **hai khái niệm "role" khác nhau**, đừng nhầm lẫn:

1. **`MessageParam.role`** — role của một message theo Anthropic Messages API, dùng khi *gửi*
   nội dung (input) hoặc đọc lại nội dung message đã lưu. Đây chính là type SDK export mà
   `src/features/agents/agents.types.ts` đang lấy lại (`SDKUserMessage['message']['role']`):

   | Giá trị | Ý nghĩa |
   | --- | --- |
   | `'user'` | Role duy nhất hợp lệ khi bạn tự dựng `SDKUserMessage` để làm input cho `query()` (theo doc comment của SDK). |
   | `'assistant'` | Role của message Claude trả lời — bạn không tự gán, chỉ gặp khi đọc lại lịch sử/response. |
   | `'system'` | Tính năng "interleaved system message" của Messages API — chèn 1 lời nhắc hệ thống tại một điểm giữa hội thoại, **khác** với `Options.systemPrompt` (system prompt tĩnh cho cả phiên). Hiếm dùng. |

2. **`SDKMessage.type`** — loại message trong **luồng response** của `query()` (assistant, user,
   system, result, stream_event, tool_progress, ...) — đây là khái niệm phân loại của riêng SDK,
   không phải "role" theo nghĩa Messages API. Đã liệt kê đầy đủ ở mục 2.

### 3.3. Tool (built-in)

SDK không export một enum tên tool đóng (field `tools`/`allowedTools`/`disallowedTools` trong
`Options` chỉ là `string[]`), nhưng gói `sdk-tools.d.ts` có định nghĩa JSON-Schema kiểu TypeScript
cho input/output của từng tool nội bộ — đây là danh sách tool đầy đủ nhất tìm được trong SDK
(tên tool suy ra từ tên type, bỏ hậu tố `Input`; `FileRead`/`FileEdit`/`FileWrite` ứng với tên
tool thật là `Read`/`Edit`/`Write`):

| Tool | Nhóm | Mô tả ngắn |
| --- | --- | --- |
| `Bash` | Thực thi | Chạy lệnh shell. |
| `Read` (`FileReadInput`) | File | Đọc nội dung file. |
| `Write` (`FileWriteInput`) | File | Tạo/ghi đè file. |
| `Edit` (`FileEditInput`) | File | Sửa một phần nội dung file có sẵn. |
| `Glob` | File | Tìm file theo pattern. |
| `Grep` | File | Tìm kiếm nội dung theo regex trong file. |
| `NotebookEdit` | File | Sửa cell trong Jupyter notebook. |
| `WebFetch` | Mạng | Tải và tóm tắt nội dung một URL. |
| `WebSearch` | Mạng | Tìm kiếm web. |
| `Agent` | Subagent | Chạy một subagent (tương ứng tool "Task"). |
| `TaskCreate` / `TaskGet` / `TaskUpdate` / `TaskList` | Task nền | Quản lý task nền có cấu trúc. |
| `TaskOutput` | Task nền | Đọc output của một background task. |
| `TaskStop` | Task nền | Dừng một task đang chạy nền. |
| `Mcp` | MCP | Gọi một tool MCP tuỳ ý. |
| `ListMcpResources` / `RefreshMcpTools` | MCP | Liệt kê resource / làm mới danh sách tool MCP. |
| `ReadMcpResource` / `ReadMcpResourceDir` | MCP | Đọc một resource MCP cụ thể / đọc cả thư mục resource. |
| `TodoWrite` | Điều phối | Quản lý danh sách todo trong phiên. |
| `AskUserQuestion` | Điều phối | Hỏi lại người dùng khi cần quyết định. |
| `EnterPlanMode` / `ExitPlanMode` | Điều phối | Vào/thoát chế độ lên kế hoạch (chỉ đọc, chưa thực thi). |
| `EnterWorktree` / `ExitWorktree` | Điều phối | Vào/ra một git worktree cô lập. |
| `ReportFindings` | Điều phối | Báo cáo kết quả review dạng có cấu trúc. |
| `SendFeedback` | Điều phối | Gửi phản hồi về Claude Code. |
| `Artifact` | Xuất bản | Publish/đọc một Artifact (trang web). |
| `ClaudeDesign` | Xuất bản | Tạo canvas thiết kế UI. |
| `PushNotification` | Thông báo | Gửi push notification. |
| `ReadNotifications` | Thông báo | Đọc thông báo đang chờ. |
| `Monitor` | Thông báo | Theo dõi tiến trình nền / stream log. |
| `CronCreate` / `CronDelete` / `CronList` / `ScheduleWakeup` | Lịch | Quản lý/hẹn giờ chạy định kỳ. |
| `RemoteTrigger` | Khác | Kích hoạt hành động từ một nguồn từ xa. |
| `Workflow` / `REPL` | Khác | Chạy workflow script định nghĩa sẵn / REPL tương tác. |
| `Projects` | Khác | Thao tác với Projects. |
| `ProposeSkills` / `ProposeGoal` | Khác | Đề xuất skill/goal mới. |
| `ShowOnboardingRolePicker` | Khác | Hiển thị UI chọn vai trò lúc onboarding. |

Danh sách **thật sự khả dụng cho một phiên cụ thể** (tuỳ CLI version, `Options.tools`, plugin...)
luôn nằm trong `SDKSystemMessage.tools: string[]` (mục 2.4) — coi bảng trên là tham khảo tĩnh, còn
response mới là nguồn xác thực runtime.

### 3.4. `PermissionMode`

`Options.permissionMode` chấp nhận đúng 6 giá trị (`export declare type PermissionMode =`
trong `sdk.d.ts:2293`):

| Giá trị | Ý nghĩa |
| --- | --- |
| `'default'` | Hành vi chuẩn — hỏi xin quyền khi thao tác nguy hiểm. |
| `'acceptEdits'` | Tự động đồng ý các thao tác sửa file. |
| `'bypassPermissions'` | Bỏ qua mọi kiểm tra quyền — bắt buộc kèm `allowDangerouslySkipPermissions: true`. |
| `'plan'` | Chế độ lên kế hoạch — không thực thi tool thật. |
| `'dontAsk'` | Không hỏi; tự động từ chối nếu chưa được duyệt trước. |
| `'auto'` | Dùng một model classifier để tự động duyệt/từ chối quyền. |

### 3.5. Các enum/const khác đáng chú ý

| Tên | Giá trị | Dùng ở đâu |
| --- | --- | --- |
| `HOOK_EVENTS` *(hằng số runtime, không chỉ type)* | `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Notification`, `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart`, `SessionEnd`, `Stop`, `StopFailure`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PostCompact`, `PreModelSwitch`, `PostModelSwitch`, `PermissionRequest`, `PermissionDenied`, `Setup`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `Elicitation`, `ElicitationResult`, `ConfigChange`, `WorktreeCreate`, `WorktreeRemove`, `InstructionsLoaded`, `CwdChanged`, `FileChanged`, `DirectoryAdded`, `MessageDisplay` | Key hợp lệ cho `Options.hooks`. Đây là mảng **thật sự tồn tại lúc runtime** (`export declare const HOOK_EVENTS`), không phải chỉ type — import được để validate/lặp. |
| `EffortLevel` | `'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'` | `Options.effort`, `AgentDefinition` (gián tiếp qua model), `SDKSystemMessage.effort`. |
| `ThinkingConfig` | `{type:'adaptive', display?}` \| `{type:'enabled', budgetTokens?, display?}` \| `{type:'disabled'}` | `Options.thinking`. |
| `SettingSource` | `'user' \| 'project' \| 'local'` | `Options.settingSources`. |
| `SdkBeta` | `'context-1m-2025-08-07'` (hiện chỉ có 1 giá trị) | `Options.betas`. |
| `ApiKeySource` | `'ANTHROPIC_API_KEY' \| 'apiKeyHelper' \| '/login managed key' \| 'none' \| 'user' \| 'project' \| 'org' \| 'temporary' \| 'oauth'` (3 giá trị cuối là legacy, CLI hiện không phát ra) | `SDKSystemMessage.apiKeySource`. |
| `TerminalReason` | `'blocking_limit'`, `'rapid_refill_breaker'`, `'prompt_too_long'`, `'image_error'`, `'model_error'`, `'api_error'`, `'malformed_tool_use_exhausted'`, `'aborted_streaming'`, `'aborted_tools'`, `'stop_hook_prevented'`, `'hook_stopped'`, `'tool_deferred'`, `'max_turns'`, `'background_requested'`, `'completed'`, `'budget_exhausted'`, `'structured_output_retry_exhausted'`, `'tool_deferred_unavailable'`, `'turn_setup_failed'` | `SDKResultMessage.terminal_reason` — lý do turn/phiên kết thúc. |
| `FastModeState` | `'off' \| 'cooldown' \| 'on'` | `SDKSystemMessage.fast_mode_state`, `SDKResultMessage.fast_mode_state`. |
| `SessionStoreFlush` | `'batched' \| 'eager'` | `Options.sessionStoreFlush`. |

## 4. Cách áp dụng vào code hiện tại

`AgentsService.run()` hiện đang là một lớp bọc (wrapper) đơn giản: nhận `prompt` + `options` tùy
chọn, gọi `query()`, và gom **tất cả** message vào một mảng `SDKMessage[]` rồi trả về. Muốn đọc
field riêng của từng loại message, phải kiểm tra `type` (và `subtype` với `'system'`/`'result'`)
trước khi truy cập:

```ts
for (const message of messages) {
  if (message.type === 'assistant') {
    // message.message, message.parent_tool_use_id, ... (field của SDKAssistantMessage)
  } else if (message.type === 'result' && message.subtype === 'success') {
    // message.result (câu trả lời cuối), message.total_cost_usd, message.usage, ...
  } else if (message.type === 'system' && message.subtype === 'init') {
    // message.model, message.tools, message.mcp_servers, ...
  }
}
```

Trong `agents.service.ts`, `options` truyền vào `query()` hiện đang được gộp với giá trị mặc định
`model: 'claude-sonnet-5'` (`{ model: 'claude-sonnet-5', ...options }`) — nếu caller tự truyền
`model` trong `options` thì giá trị đó sẽ ghi đè lên mặc định này.
