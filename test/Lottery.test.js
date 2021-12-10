const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());

const { interface, bytecode } = require('../compile');

let lottery;
let accounts;

beforeEach( async () => {
    accounts = await web3.eth.getAccounts();

    lottery = await new web3.eth.Contract(JSON.parse(interface))
        .deploy({ data: bytecode })
        .send({ from: accounts[0], gas: '1000000' });
});

describe('Lottery Contract', () => {
    it('deploys a contract', () => {
        assert.ok(lottery.options.address);
    });

    it('allows one account to enter', async () => {
        await lottery.methods.enter().send({
            from: accounts[0],
            value: web3.utils.toWei('0.02', 'ether')
        });

        const players = await lottery.methods.getPlayers().call({
            from: accounts[0]
        });

        assert.equal(accounts[0], players[0]);
        assert.equal(1, players.length);
    });

    it('allows multiple accounts to enter', async () => {
        await lottery.methods.enter().send({
            from: accounts[0],
            value: web3.utils.toWei('0.02', 'ether')
        });
        await lottery.methods.enter().send({
            from: accounts[1],
            value: web3.utils.toWei('0.02', 'ether')
        });
        await lottery.methods.enter().send({
            from: accounts[2],
            value: web3.utils.toWei('0.02', 'ether')
        });

        const players = await lottery.methods.getPlayers().call({
            from: accounts[0]
        });

        assert.equal(accounts[0], players[0]);
        assert.equal(accounts[1], players[1]);
        assert.equal(accounts[2], players[2]);
        assert.equal(3, players.length);
    });
    // Reason why do the similar testing twice for 'allows one account to enter' and 'allows multiple accounts to enter'
    // For the reality, if one fails, then it's not necessarily the case that the other one will fail as well
    // It could get into some crazy situation where it accidentally is only storing the latest account to enter into the lottery
    // By making sure that, have a test for checking both - one account and multiple, it can catch that off chance case
    // The above contracts are storing money and should make sure that they are always handled as securely as possible

    it('requires a minimum amount of ether to enter', async () => {
        try {
            await lottery.methods.enter().send({
                from: accounts[0],
                value: 0
            });
            assert(false);
        } catch (err) {
            assert(err);
        }
    });
    // For checking enter() function : require(msg.value > .01 ether);
    // use try, catch statement
    // as it's trying to send 0(wei) to the lottery, it will be failed certainly
    // when it's going on regular way, this function will stop running at assert(err) without error
    // for some unexpected reason, if it succeeded to enter to lottery with 0(wei), manually input assert(false); to stop running

    it('only manager can call pickWinner', async () => {
        try {
            await lottery.methods.pickWinner().send({
                from: accounts[1]
            });
            assert(false);
        } catch (err) {
            assert(err);
        }
    });

    it('sends money to the winner and resets the players array', async () => {
        // enter only one player(manager), send 2 ether to the lottery and receive it again after doing pickWinner() because there's only one player
        // by compare manager balance after sending 2 ether and receiving 2 ether, it confirms the pickWinner() transfer ether to the winner
        // it costs some gas while doing the above process, so the difference balance will be less than 2 ether (more than 1.8 is enough to confirm)
        await lottery.methods.enter().send({
            from: accounts[0],
            value: web3.utils.toWei('2', 'ether')
        });
        const initialBalance = await web3.eth.getBalance(accounts[0]);

        await lottery.methods.pickWinner().send({
            from: accounts[0]
        });
        
        const finalBalance = await web3.eth.getBalance(accounts[0]);
        const difference = finalBalance - initialBalance;
        // console.log(difference);
        assert(difference > web3.utils.toWei('1.8', 'ether'));

        // confirm if there's still players left after the pickWinner() is done. If there's no player, it's correct.
        const players = await lottery.methods.getPlayers().call({
            from: accounts[0]
        });
        assert.equal(0, players.length);

        // confirm if lottery still has avaialble balance after the pickWinner() is done. If the lottery balance is empty (0 ether), it's correct.
        var lotteryBalance = await web3.eth.getBalance(lottery.options.address);
        assert.ok(lotteryBalance == web3.utils.toWei('0', 'ether'))
    });
});