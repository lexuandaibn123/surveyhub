use crate::schema::*;
use crate::errors::ErrorCode;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::invoke;

#[derive(Accounts)]
#[instruction(content: String, id: String)]
pub struct SubmitForm<'info> {
    #[account(mut)]
    pub form: Account<'info, Form>,
    #[account(init, seeds = [id.as_bytes(), author.key().as_ref()],
        bump, payer = system, space = 8 + 4 + id.len() + 32 + 32 + 8 + 4 + content.len())]
    pub form_submission: Account<'info, FormSubmissions>,
    #[account(mut)]
    pub author: Signer<'info>,
    #[account(mut)]
    pub system: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn exec(ctx: Context<SubmitForm>, content: String, id: String) -> Result<()> {
    let form_submission = &mut ctx.accounts.form_submission;
    form_submission.author = ctx.accounts.author.key();
    form_submission.id = id;
    form_submission.created_at = Clock::get()?.unix_timestamp;
    form_submission.form_id = ctx.accounts.form.key();
    form_submission.content = content;

    ctx.accounts.form.submissions += 1;

    // Xử lý SOL nếu không có mint
    let amount_lamports = (ctx.accounts.form.sol_per_user * 1_000_000_000.0) as u64;
    let system_balance = ctx.accounts.system.to_account_info().lamports();
    if system_balance < amount_lamports || ctx.accounts.form.remain_sol < ctx.accounts.form.sol_per_user {
        return Err(ErrorCode::UnavailableBalance.into());
    }

    let transfer_instruction = system_instruction::transfer(
        &ctx.accounts.system.key(),
        &ctx.accounts.author.key(),
        amount_lamports,
    );

    let result = invoke(
        &transfer_instruction,
        &[
            ctx.accounts.system.to_account_info(),
            ctx.accounts.author.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    );

    match result {
        Ok(_) => {
            ctx.accounts.form.remain_sol -= ctx.accounts.form.sol_per_user;
        }
        Err(err) => {
            msg!("Failed to transfer SOL: {:?}", err);
            return Err(ErrorCode::TransferFailed.into());
        }
    }

    Ok(())
}
